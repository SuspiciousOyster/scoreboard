package com.carolinarollergirls.scoreboard.core;

import java.util.Map;

import com.carolinarollergirls.scoreboard.core.admin.ClientsImpl;
import com.carolinarollergirls.scoreboard.core.interfaces.Clients;
import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProviderImpl;
import com.carolinarollergirls.scoreboard.event.Value;
import com.carolinarollergirls.scoreboard.json.JSONStateManager;
import com.carolinarollergirls.scoreboard.utils.ValWithId;
import com.carolinarollergirls.scoreboard.utils.Version;

public final class ScoreBoardImpl extends ScoreBoardEventProviderImpl<ScoreBoard> implements ScoreBoard {
    public ScoreBoardImpl(boolean useMetrics) {
        super(null, "", null);
        this.useMetrics = useMetrics;
        jsm = new JSONStateManager(useMetrics);
        addProperties(props);
        setupScoreBoard();
    }

    protected void setupScoreBoard() {
        removeAll(VERSION);
        for (Map.Entry<String, String> entry : Version.getAll().entrySet()) {
            add(VERSION, new ValWithId(entry.getKey(), entry.getValue()));
        }
        addWriteProtection(VERSION);
        add(CLIENTS, new ClientsImpl(this));
        addWriteProtection(CLIENTS);
    }

    @Override
    public Object computeValue(Value<?> prop, Object value, Object last, Source source, Flag flag) {
        if ((prop == TEAM_1_POINTS || prop == TEAM_2_POINTS) && (Integer) value < 0) { return 0; }
        return value;
    }

    @Override
    public void postAutosaveUpdate() {
        synchronized (coreLock) {
            // Nothing to do
        }
    }

    @Override
    public Clients getClients() {
        return get(CLIENTS, "");
    }

    @Override
    public JSONStateManager getJsm() {
        return jsm;
    }

    @Override
    public boolean useMetrics() {
        return useMetrics;
    }

    @Override
    public boolean isInitialLoadDone() {
        return initialLoadDone;
    }

    private JSONStateManager jsm;
    private boolean useMetrics;
    private boolean initialLoadDone = false;
}
