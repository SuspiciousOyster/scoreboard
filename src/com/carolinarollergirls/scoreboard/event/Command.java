package com.carolinarollergirls.scoreboard.event;

import java.util.Collection;

/**
 * A command that can be executed on an object.
 * <p>
 * When the commmand's property is set to True, <code>ScoreBoardEventProvider.execute()</code> is called for the
 * property.
 * </p>
 */
public class Command extends Property<Boolean> {
    public Command(String jsonName, Collection<Property<?>> propsToAddTo) {
        super(Boolean.class, jsonName, propsToAddTo);
    }
}
