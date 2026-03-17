package com.carolinarollergirls.scoreboard.jetty;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.fileupload.FileItemIterator;
import org.apache.commons.fileupload.FileItemStream;
import org.apache.commons.fileupload.FileUploadException;
import org.apache.commons.fileupload.servlet.ServletFileUpload;

import com.fasterxml.jackson.jr.ob.JSON;

import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProvider.Source;
import com.carolinarollergirls.scoreboard.json.ScoreBoardJSONSetter;

/**
 * Servlet to handle requests from web browser to upload a JSON or XLSX file.
 */
public class LoadJsonScoreBoard extends HttpServlet {
    public LoadJsonScoreBoard(ScoreBoard sb) { this.scoreBoard = sb; }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {
        if (scoreBoard.getClients().getDevice(request.getSession().getId()).mayWrite()) {
            scoreBoard.getClients().getDevice(request.getSession().getId()).write();
            try {
                if (!ServletFileUpload.isMultipartContent(request)) {
                    response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                    return;
                }

                ServletFileUpload sfU = new ServletFileUpload();
                FileItemIterator items = sfU.getItemIterator(request);
                while (items.hasNext()) {
                    FileItemStream item = items.next();
                    if (!item.isFormField()) {
                        if (request.getPathInfo().equalsIgnoreCase("/JSON")) {
                            runningImports.incrementAndGet();
                            InputStream stream = item.openStream();
                            Map<String, Object> map = JSON.std.mapFrom(stream);
                            stream.close();
                            @SuppressWarnings("unchecked")
                            Map<String, Object> state = (Map<String, Object>) map.get("state");
                            ScoreBoardJSONSetter.updateToCurrentVersion(state);
                            scoreBoard.runInBatch(new Runnable() {
                                @Override
                                public void run() {
                                    ScoreBoardJSONSetter.set(scoreBoard, state, Source.JSON);
                                }
                            });
                            runningImports.decrementAndGet();
                            response.setContentType("text/plain");
                            response.setStatus(HttpServletResponse.SC_OK);

                            synchronized (runningImports) {
                                if (runningImports.get() == 0) { scoreBoard.cleanupAliases(); }
                            }
                        }
                        return;
                    }
                }
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "No File uploaded");
            } catch (FileUploadException fuE) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, fuE.getMessage());
            } catch (IOException iE) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Error Reading File: " + iE.getMessage());
            }
        } else {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "No write access");
        }
    }

    protected final ScoreBoard scoreBoard;

    protected static AtomicInteger runningImports = new AtomicInteger(0);
}
