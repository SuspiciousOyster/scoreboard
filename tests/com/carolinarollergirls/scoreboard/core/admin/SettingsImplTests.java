package com.carolinarollergirls.scoreboard.core.admin;

import static org.junit.Assert.assertSame;

import org.junit.Before;
import org.junit.Test;

import com.carolinarollergirls.scoreboard.core.ScoreBoardImpl;

public class SettingsImplTests {

    private ScoreBoardImpl sb;
    private SettingsImpl settings;

    @Before
    public void setup() {
        sb = new ScoreBoardImpl(false);

        settings = new SettingsImpl(sb);
    }

    @Test
    public void test_set() {
        settings.set("Example", "ABC");

        assertSame("ABC", settings.get("Example"));
    }
}
