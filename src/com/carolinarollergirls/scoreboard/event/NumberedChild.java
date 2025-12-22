package com.carolinarollergirls.scoreboard.event;

import java.util.Collection;

/** A <code>Child</code> where the IDs of the children are numbers. */
public class NumberedChild<T extends OrderedScoreBoardEventProvider<T>> extends Child<T> {
    public NumberedChild(Class<T> type, String jsonName, Collection<Property<?>> propsToAddTo) {
        super(type, jsonName, propsToAddTo);
    }
}
