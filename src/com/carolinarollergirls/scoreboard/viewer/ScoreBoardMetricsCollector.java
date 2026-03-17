package com.carolinarollergirls.scoreboard.viewer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;

import io.prometheus.client.Collector;
import io.prometheus.client.GaugeMetricFamily;

public class ScoreBoardMetricsCollector extends Collector {
    private ScoreBoard sb;

    public ScoreBoardMetricsCollector(ScoreBoard sb) { this.sb = sb; }
    @Override
    public List<MetricFamilySamples> collect() {
        List<MetricFamilySamples> mfs = new ArrayList<>();

        GaugeMetricFamily score =
            new GaugeMetricFamily("crg_scoreboard_team_score", "Score on scoreboard.", Arrays.asList("team", "name"));
        mfs.add(score);
        score.addMetric(Arrays.asList("1", sb.get(ScoreBoard.TEAM_1_NAME)), sb.get(ScoreBoard.TEAM_1_POINTS));
        score.addMetric(Arrays.asList("2", sb.get(ScoreBoard.TEAM_2_NAME)), sb.get(ScoreBoard.TEAM_2_POINTS));

        return mfs;
    }
}
