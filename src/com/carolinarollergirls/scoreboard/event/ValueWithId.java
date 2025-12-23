package com.carolinarollergirls.scoreboard.event;

/** Base class for types held in <code>Child</code> properties */
public interface ValueWithId {
    /**
     * ID to be used in order to identify this element amongst all elements of its
     * type. Used when the element is referenced by elements other than its parent.
     * (Typically a UUID.)
     */
    public String getId();
    /**
     * String representation of the element's value to be used in JSON. For complex types this will usually be the ID.
     */
    public String getValue();
}
