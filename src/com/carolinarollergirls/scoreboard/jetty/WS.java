package com.carolinarollergirls.scoreboard.jetty;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import org.eclipse.jetty.websocket.servlet.ServletUpgradeRequest;
import org.eclipse.jetty.websocket.servlet.ServletUpgradeResponse;
import org.eclipse.jetty.websocket.servlet.WebSocketCreator;
import org.eclipse.jetty.websocket.servlet.WebSocketServlet;
import org.eclipse.jetty.websocket.servlet.WebSocketServletFactory;

import com.fasterxml.jackson.jr.ob.JSON;

import com.carolinarollergirls.scoreboard.core.interfaces.Clients.Client;
import com.carolinarollergirls.scoreboard.core.interfaces.Clients.Device;
import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProvider.Flag;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProvider.Source;
import com.carolinarollergirls.scoreboard.json.JSONStateListener;
import com.carolinarollergirls.scoreboard.json.JSONStateManager;
import com.carolinarollergirls.scoreboard.json.ScoreBoardJSONSetter;
import com.carolinarollergirls.scoreboard.utils.Logger;

import io.prometheus.client.Counter;
import io.prometheus.client.Gauge;
import io.prometheus.client.Histogram;

/** Servlet to handle creating WebSocket connections to web browser clients. */
public class WS extends WebSocketServlet {

    public WS(ScoreBoard s, JSONStateManager j, boolean useMetrics) {
        sb = s;
        jsm = j;
        this.useMetrics = useMetrics;
        if (useMetrics) {
            connectionsActive =
                Gauge.build().name("crg_websocket_active_connections").help("Current WebSocket connections").register();
            messagesReceived = Counter.build()
                                   .name("crg_websocket_messages_received")
                                   .help("Number of WebSocket messages received")
                                   .register();
            messagesSentDuration = Histogram.build()
                                       .name("crg_websocket_messages_sent_duration_seconds")
                                       .help("Time spent sending WebSocket messages")
                                       .register();
            messagesSentFailures = Counter.build()
                                       .name("crg_websocket_messages_sent_failed")
                                       .help("Number of WebSocket messages we failed to send")
                                       .register();
        } else {
            connectionsActive = null;
            messagesReceived = null;
            messagesSentDuration = null;
            messagesSentFailures = null;
        }
    }

    @Override
    public void configure(WebSocketServletFactory factory) {
        factory.setCreator(new ScoreBoardWebSocketCreator());
    }

    private boolean hasPermission(Device device, String action) {
        switch (action) {
        case "Register":
        case "Ping": return true;
        case "Set":
        case "StartNewGame":
        default: return device.mayWrite();
        }
    }

    private ScoreBoard sb;
    private JSONStateManager jsm;
    private boolean useMetrics;

    private final Gauge connectionsActive;
    private final Counter messagesReceived;
    private final Histogram messagesSentDuration;
    private final Counter messagesSentFailures;

    public class ScoreBoardWebSocketCreator implements WebSocketCreator {
        @Override
        public Object createWebSocket(ServletUpgradeRequest request, ServletUpgradeResponse response) {
            HttpServletRequest baseRequest = request.getHttpServletRequest();
            String httpSessionId = baseRequest.getSession().getId();
            String remoteAddress = baseRequest.getRemoteAddr();
            String source = baseRequest.getParameter("source");
            if (source == null) { source = "CUSTOM CLIENT"; }
            String platform = baseRequest.getParameter("platform");
            if (platform == null) { platform = baseRequest.getHeader("User-Agent"); }
            return new ScoreBoardWebSocket(httpSessionId, remoteAddress, source, platform);
        }
    }

    @WebSocket(maxTextMessageSize = 1024 * 1024)
    public class ScoreBoardWebSocket implements JSONStateListener {

        public ScoreBoardWebSocket(String httpSessionId, String remoteAddress, String source, String platform) {
            device = sb.getClients().getOrAddDevice(httpSessionId);
            sbClient = sb.getClients().addClient(device.getId(), remoteAddress, source, platform);
        }

        @OnWebSocketMessage
        public void onMessage(Session session, String message_data) {
            if (useMetrics) { messagesReceived.inc(); }
            try {
                Map<String, Object> json = JSON.std.mapFrom(message_data);
                String action = (String) json.get("action");
                if (!hasPermission(device, action)) {
                    json = new HashMap<>();
                    json.put("authorization", "Not authorized for " + action);
                    send(json);
                    return;
                }
                switch (action) {
                case "Register":
                    List<?> jsonPaths = (List<?>) json.get("paths");
                    if (jsonPaths != null) {
                        PathTrie newPaths = new PathTrie();
                        for (Object p : jsonPaths) { newPaths.add((String) p); }
                        synchronized (state) {
                            sendWSUpdates(newPaths, state);
                            this.paths.merge(newPaths);
                        }
                    }
                    break;
                case "Set":
                    sbClient.write();
                    String key = (String) json.get("key");
                    Object value = json.get("value");
                    String v;
                    if (value == null) {
                        // Null deletes the setting.
                        v = null;
                    } else {
                        v = value.toString();
                    }
                    Flag flag = null;
                    String f = (String) json.get("flag");
                    if ("reset".equals(f)) { flag = Flag.RESET; }
                    if ("change".equals(f)) { flag = Flag.CHANGE; }
                    final ScoreBoardJSONSetter.JSONSet js = new ScoreBoardJSONSetter.JSONSet(key, v, flag);
                    sb.runInBatch(new Runnable() {
                        @Override
                        public void run() {
                            ScoreBoardJSONSetter.set(sb, Collections.singletonList(js), Source.WS);
                        }
                    });
                    break;
                case "Ping":
                    json = new HashMap<>();
                    json.put("Pong", "");
                    send(json);

                    // This is usually only every 30s, so often enough
                    // to cover us if our process is terminated uncleanly
                    // without having to build something just for it
                    // or risking an update loop.
                    device.access();
                    break;
                default: sendError("Unknown Action '" + action + "'"); break;
                }
            } catch (Exception je) {
                Logger.printMessage("Error handling JSON message: " + je);
                Logger.printStackTrace(je);
            }
        }

        public void send(Map<String, Object> json) {
            Histogram.Timer timer = useMetrics ? messagesSentDuration.startTimer() : null;
            try {
                wsSession.getRemote().sendStringByFuture(
                    JSON.std.with(JSON.Feature.WRITE_NULL_PROPERTIES).composeString().addObject(json).finish());
            } catch (Exception e) {
                Logger.printMessage("Error sending JSON update: " + e);
                Logger.printStackTrace(e);
                if (useMetrics) { messagesSentFailures.inc(); }
            } finally {
                if (useMetrics) { timer.observeDuration(); }
            }
        }

        @OnWebSocketConnect
        public void onOpen(Session session) {
            wsSession = session;
            if (useMetrics) { connectionsActive.inc(); }
            jsm.register(this);
            device.access();

            Map<String, Object> json = new HashMap<>();
            Map<String, Object> initialState = new HashMap<>();
            // Inject some of our own WS-specific information.
            // Session id is not included, as that's the secret cookie which
            // is meant to be httpOnly.
            initialState.put("WS.Device.Id", device.getId());
            initialState.put("WS.Device.Name", device.getName());
            initialState.put("WS.Client.Id", sbClient.getId());
            initialState.put("WS.Client.RemoteAddress", session.getRemoteAddress().getAddress().getHostAddress());
            json.put("state", initialState);
            send(json);
        }

        @OnWebSocketClose
        public void onClose(int closeCode, String message) {
            if (useMetrics) { connectionsActive.dec(); }
            jsm.unregister(this);
            sb.getClients().removeClient(sbClient);

            device.access();
        }

        public void sendError(String message) {
            Map<String, Object> json = new HashMap<>();
            json.put("error", message);
            send(json);
        }

        // State changes from JSONStateManager.
        @Override
        public void sendUpdates(StateTrie fullState, StateTrie changedState) {
            synchronized (state) {
                state = fullState;
                sendWSUpdates(paths, changedState);
            }
        }

        private void sendWSUpdates(PathTrie registered, StateTrie updated) {
            Map<String, Object> updates = registered.intersect(updated, true);
            if (updates.size() == 0) { return; }
            Map<String, Object> json = new HashMap<>();
            json.put("state", updates);
            send(json);
        }

        protected Client sbClient;
        protected Device device;
        protected PathTrie paths = new PathTrie();
        private StateTrie state = new StateTrie();
        private Session wsSession;
    }
}
