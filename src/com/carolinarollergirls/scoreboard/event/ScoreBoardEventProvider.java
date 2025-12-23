package com.carolinarollergirls.scoreboard.event;

import java.util.Collection;

import com.carolinarollergirls.scoreboard.core.interfaces.ScoreBoard;

/**
 * Base for classes holding scoreboard values and business logic
 * <p>
 * Each instance is accessible in the frontend/json through a corresponding path. Values stored in properties are
 * automatically sent out and updates are automatically incorporated. This class also provides functionality to be watch
 * other instances for value changes and react to them.
 * </p>
 */
public interface ScoreBoardEventProvider extends ValueWithId, Comparable<ScoreBoardEventProvider> {
    /**
     * This is the frontend string (i.e. path component) for the Child enum value corresponding to
     * this type in its parent element.
     */
    public String getProviderName();
    /**
     * This should return the class or (usually) interface that this type will be accessed
     * through by event receivers.
     */
    public Class<? extends ScoreBoardEventProvider> getProviderClass();
    /**
     * ID to be used in order to identify this element amongst its siblings. (Could
     * e.g. be a Period/Jam/etc number or a UUID.)
     */
    public String getProviderId();
    public ScoreBoardEventProvider getParent();
    public boolean isAncestorOf(ScoreBoardEventProvider other);
    /**
     * Remove all references to this element.
     * <p>Equivalent to {@code delete(Source.UNLINK)}</p>
     */
    public void delete();
    /** Remove all references to this element. */
    public void delete(Source source);

    /** @return All the values, children, or commands that can be accessed from the frontend. */
    public Collection<Property<?>> getProperties();
    public Property<?> getProperty(String jsonName);

    public void addScoreBoardListener(ScoreBoardListener listener);
    public void removeScoreBoardListener(ScoreBoardListener listener);

    public <T> T valueFromString(Value<T> prop, String sValue);
    public <T> T get(Value<T> prop);
    /** @return true, if value was changed */
    public <T> boolean set(Value<T> prop, T value);
    /**
     * Change flag for Integer and Long values is implemented to add the given value to the previous one. Other flags
     * need to be implemented in overrides.
     * @return true, if value was changed
     */
    public <T> boolean set(Value<T> prop, T value, Flag flag);
    /** @return true, if value was changed */
    public <T> boolean set(Value<T> prop, T value, Source source);
    /**
     * Change flag for Integer and Long values is implemented to add the given value to the previous one. Other flags
     * need to be implemented in overrides.
     * @return true, if value was changed
     */
    public <T> boolean set(Value<T> prop, T value, Source source, Flag flag);

    /** Run the given function inside a batch, to combine any resultant events in a single frontend update. */
    public void runInBatch(Runnable r);

    /**
     * If create is implemented for the respective type, this function will resort
     * to that, ignoring sValue. Otherwise it will create a ValWithId from id and
     * sValue.
     */
    public <T extends ValueWithId> T childFromString(Child<T> prop, String id, String sValue);
    /** @return null if no such child is found */
    public <T extends ValueWithId> T get(Child<T> prop, String id);
    /** @return null if no such child is found */
    public <T extends OrderedScoreBoardEventProvider<T>> T get(NumberedChild<T> prop, Integer num);
    public <T extends ScoreBoardEventProvider> T getOrCreate(Child<T> prop, String id);
    public <T extends ScoreBoardEventProvider> T getOrCreate(Child<T> prop, String id, Source source);
    public <T extends OrderedScoreBoardEventProvider<T>> T getOrCreate(NumberedChild<T> prop, Integer num);
    public <T extends OrderedScoreBoardEventProvider<T>> T getOrCreate(NumberedChild<T> prop, Integer num,
                                                                       Source source);
    public <T extends ValueWithId> Collection<T> getAll(Child<T> prop);
    public <T extends OrderedScoreBoardEventProvider<T>> T getFirst(NumberedChild<T> prop);
    public <T extends OrderedScoreBoardEventProvider<T>> T getLast(NumberedChild<T> prop);
    public int numberOf(Child<?> prop);
    /** @return true, if a value was either changed or added */
    public <T extends ValueWithId> boolean add(Child<T> prop, T item);
    /** @return true, if a value was either changed or added */
    public <T extends ValueWithId> boolean add(Child<T> prop, T item, Source source);
    /** @return true, if a value was removed */
    public <T extends ValueWithId> boolean remove(Child<T> prop, String id);
    /** @return true, if a value was removed */
    public <T extends ValueWithId> boolean remove(Child<T> prop, String id, Source source);
    /** @return true, if a value was removed */
    public <T extends ValueWithId> boolean remove(Child<T> prop, T item);
    /** @return true, if a value was removed */
    public <T extends ValueWithId> boolean remove(Child<T> prop, T item, Source source);
    public <T extends ValueWithId> void removeAll(Child<T> prop);
    public <T extends ValueWithId> void removeAll(Child<T> prop, Source source);
    /**
     * To be overridden by implementations. Is expected to create an instance of the given child with the given id or
     * null if the given source is not allowed to create the given child.
     */
    public ScoreBoardEventProvider create(Child<? extends ScoreBoardEventProvider> prop, String id, Source source);
    public Integer getMinNumber(NumberedChild<?> prop);
    public Integer getMaxNumber(NumberedChild<?> prop);

    /** To be overridden by implementations. This is called when a <code>Command</code> is invoked from the frontend. */
    public void execute(Command prop);
    /** To be overridden by implementations. This is called when a <code>Command</code> is invoked from the frontend. */
    public void execute(Command prop, Source source);

    public ScoreBoard getScoreBoard();

    public <T extends ValueWithId> T getElement(Class<T> type, String id);

    /** Verify that the property is one registered with this object. */
    public void checkProperty(Property<?> prop);

    public void cleanupAliases();

    public static final Value<String> ID = new Value<>(String.class, "Id", "", null);
    public static final Value<Boolean> READONLY = new Value<>(Boolean.class, "Readonly", false, null);

    /** Type of the source requesting the event, change, or action. */
    public enum Source {
        WS(false, false),
        AUTOSAVE(false, true),
        JSON(false, true),
        INVERSE_REFERENCE(true, false),
        COPY(true, false),
        RECALCULATE(true, false),
        UNLINK(true, false),
        RENUMBER(true, false),
        OTHER(true, false),

        // the following are intended for use as writeProtection Override only;
        ANY_INTERNAL(true, false),
        ANY_FILE(false, true),
        NON_WS(true, true);

        private Source(boolean internal_, boolean file_) {
            internal = internal_;
            file = file_;
        }

        private final boolean internal;
        private final boolean file;

        public boolean isInternal() { return internal; }
        public boolean isFile() { return file; }
    }

    /** Flags that affect how an update from the frontend is processed */
    public enum Flag {
        CHANGE,
        RESET,
        SPECIAL_CASE;
    }
}
