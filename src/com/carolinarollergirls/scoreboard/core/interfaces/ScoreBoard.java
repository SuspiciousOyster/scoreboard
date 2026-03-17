package com.carolinarollergirls.scoreboard.core.interfaces;

import java.util.ArrayList;
import java.util.Collection;

import com.carolinarollergirls.scoreboard.event.Child;
import com.carolinarollergirls.scoreboard.event.Property;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProvider;
import com.carolinarollergirls.scoreboard.event.Value;
import com.carolinarollergirls.scoreboard.json.JSONStateManager;
import com.carolinarollergirls.scoreboard.utils.ValWithId;

public interface ScoreBoard extends ScoreBoardEventProvider {
    /** Update state after restoring from autosave */
    public void postAutosaveUpdate();

    public Clients getClients();

    public JSONStateManager getJsm();
    public boolean useMetrics();

    public boolean isInitialLoadDone();

    public static Collection<Property<?>> props = new ArrayList<>();

    public static final Value<String> TEAM_1_NAME = new Value<>(String.class, "Team1Name", "Team 1", props);
    public static final Value<String> TEAM_2_NAME = new Value<>(String.class, "Team2Name", "Team 2", props);
    public static final Value<Integer> TEAM_1_POINTS = new Value<>(Integer.class, "Team1Points", 0, props);
    public static final Value<Integer> TEAM_2_POINTS = new Value<>(Integer.class, "Team2Points", 0, props);

    public static final Child<ValWithId> VERSION = new Child<>(ValWithId.class, "Version", props);
    public static final Child<Clients> CLIENTS = new Child<>(Clients.class, "Clients", props);
}
