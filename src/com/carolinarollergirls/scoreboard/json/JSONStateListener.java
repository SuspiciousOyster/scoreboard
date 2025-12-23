package com.carolinarollergirls.scoreboard.json;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.TreeMap;

public interface JSONStateListener {
    /**
     * A snapshot of the current state, and which keys in it have changed.
     * <p>
     * Keys with a value of null are considered deleted, and will only be present in changed, not in state.
     * </p>
     */
    public void sendUpdates(StateTrie state, StateTrie changed);

    final class PathTrie {
        boolean isPath = false;
        Map<String, PathTrie> subtries = new HashMap<>();

        public PathTrie() {}
        public PathTrie(Set<String> content) { addAll(content); }

        public void addAll(Set<String> c) {
            for (String p : c) { add(p); }
        }
        public void add(String path) {
            String[] p = path.split("(?=[.(])");
            PathTrie head = this;
            for (int i = 0; !head.isPath && i < p.length; i++) {
                if (head.subtries.containsKey(p[i])) {
                    head = head.subtries.get(p[i]);
                } else {
                    PathTrie child = new PathTrie();
                    head.subtries.put(p[i], child);
                    head = child;
                }
            }
            head.isPath = true;
        }

        public boolean covers(String p) { return _covers(p.split("(?=[.(])"), 0); }
        private boolean _covers(String[] p, int i) {
            PathTrie head = this;
            for (;; i++) {
                if (head.isPath) { return true; }
                if (i >= p.length) { return false; }
                // Allow Blah(*).
                String catchAllKey = p[i].charAt(0) + "*)";
                if (head.subtries.containsKey(catchAllKey)) {
                    int j;
                    // id captured by * might contain . and thus be split - find the end
                    for (j = i; j < p.length && !p[j].endsWith(")"); j++);
                    if (head.subtries.get(catchAllKey)._covers(p, j + 1)) { return true; }
                }
                head = head.subtries.get(p[i]);
                if (head == null) { return false; }
            }
        }

        public void merge(PathTrie other) {
            if (other.isPath) { isPath = true; }
            for (String key : other.subtries.keySet()) {
                if (subtries.containsKey(key)) {
                    subtries.get(key).merge(other.subtries.get(key));
                } else {
                    subtries.put(key, other.subtries.get(key));
                }
            }
        }

        public Map<String, Object> intersect(StateTrie stateTrie, boolean filterSecrets) {
            Map<String, Object> results = new TreeMap<>();
            if (stateTrie != null) { _intersect(stateTrie, results, "", filterSecrets, false); }
            return results;
        }
        private void _intersect(StateTrie stateTrie, Map<String, Object> results, String prefix, boolean filterSecrets,
                                boolean coveringAsterisk) {
            if (coveringAsterisk) {
                for (String otherKey : stateTrie.subtries.keySet()) {
                    _intersect(stateTrie.subtries.get(otherKey), results, prefix + otherKey, filterSecrets,
                               !otherKey.endsWith(")"));
                }
            } else if (isPath) {
                stateTrie.fetchAll(results, prefix, filterSecrets);
            } else {
                for (String key : subtries.keySet()) {
                    if (key.endsWith("*)")) {
                        for (String otherKey : stateTrie.subtries.keySet()) {
                            subtries.get(key)._intersect(stateTrie.subtries.get(otherKey), results, prefix + otherKey,
                                                         filterSecrets, !otherKey.endsWith(")"));
                        }
                    } else if (stateTrie.subtries.containsKey(key)) {
                        subtries.get(key)._intersect(stateTrie.subtries.get(key), results, prefix + key, filterSecrets,
                                                     false);
                    }
                }
            }
        }
    }

    final class StateTrie implements Cloneable {
        boolean isPath;
        Object value;
        Map<String, StateTrie> subtries = new HashMap<>();

        public StateTrie() {}
        public StateTrie(Map<String, Object> content) { addAll(content); }

        @Override
        public StateTrie clone() {
            return _clone(false);
        }
        private StateTrie _clone(boolean nullValues) {
            StateTrie clone = new StateTrie();
            clone.isPath = isPath;
            clone.value = nullValues ? null : value;
            for (String key : subtries.keySet()) { clone.subtries.put(key, subtries.get(key)._clone(nullValues)); }
            return clone;
        }
        private StateTrie _nulledClone() { return _clone(true); }

        public Object get(String key) { return _get(key.split("(?=[.(])"), 0); }
        private Object _get(String[] p, int i) {
            if (i == p.length) {
                return value;
            } else if (subtries.containsKey(p[i])) {
                return subtries.get(p[i])._get(p, i + 1);
            } else {
                return null;
            }
        }
        public Map<String, Object> getAll(boolean filterSecrets) {
            Map<String, Object> results = new TreeMap<>();
            fetchAll(results, "", filterSecrets);
            return results;
        }
        public void fetchAll(Map<String, Object> results, String prefix, boolean filterSecrets) {
            if (isPath && (!filterSecrets || !prefix.endsWith("Secret"))) { results.put(prefix, value); }
            for (String key : subtries.keySet()) { subtries.get(key).fetchAll(results, prefix + key, filterSecrets); }
        }
        public boolean isEmpty() { return !isPath && subtries.isEmpty(); }
        public int size() {
            int size = isPath ? 1 : 0;
            for (StateTrie subtrie : subtries.values()) { size += subtrie.size(); }
            return size;
        }

        public void addAll(Map<String, Object> c) {
            for (String p : c.keySet()) { add(p, c.get(p)); }
        }
        public void add(String path, Object val) {
            String[] p = path.split("(?=[.(])");
            StateTrie head = this;
            for (int i = 0; i < p.length; i++) {
                if (head.subtries.containsKey(p[i])) {
                    head = head.subtries.get(p[i]);
                } else {
                    StateTrie child = new StateTrie();
                    head.subtries.put(p[i], child);
                    head = child;
                }
            }
            head.isPath = true;
            head.value = val;
            if (val == null) { head.subtries.clear(); }
        }

        public void remove(String path) { _remove(path.split("(?=[.(])"), 0); }
        public boolean _remove(String[] p, int i) {
            if (i == p.length) {
                value = null;
                isPath = false;
            } else if (subtries.containsKey(p[i])) {
                if (subtries.get(p[i])._remove(p, i + 1)) { subtries.remove(p[i]); }
            }
            return isEmpty();
        }

        public StateTrie cloneAndMergeChangeTrie(StateTrie changeTrie) {
            return _cloneAndMergeChangeTrie(changeTrie, false);
        }
        public StateTrie _cloneAndMergeChangeTrie(StateTrie changeTrie, boolean removing) {
            StateTrie clone = new StateTrie();
            if (changeTrie.isPath) {
                if (isPath && value.equals(changeTrie.value)) {
                    changeTrie.isPath = false;
                    clone.value = value;
                    clone.isPath = true;
                } else {
                    changeTrie.isPath = isPath || changeTrie.value != null;
                    clone.value = changeTrie.value;
                    clone.isPath = clone.value != null;
                    removing = removing || value == null;
                }
            } else {
                clone.value = removing ? null : value;
                clone.isPath = isPath && !removing;
            }

            Set<String> allKeys = new HashSet<>(subtries.keySet());
            allKeys.addAll(changeTrie.subtries.keySet());
            for (String key : allKeys) {
                if (changeTrie.subtries.containsKey(key)) {
                    if (subtries.containsKey(key)) {
                        // exists in both - recurse
                        StateTrie subclone =
                            subtries.get(key)._cloneAndMergeChangeTrie(changeTrie.subtries.get(key), removing);
                        if (!subclone.isEmpty()) { clone.subtries.put(key, subclone); }
                        if (changeTrie.subtries.get(key).isEmpty()) { changeTrie.subtries.remove(key); }
                    } else {
                        // addition
                        StateTrie subclone = changeTrie.subtries.get(key)._cleanAndClone();
                        if (subclone == null) {
                            changeTrie.subtries.remove(key);
                        } else {
                            clone.subtries.put(key, subclone);
                        }
                    }
                } else if (removing) {
                    // removing - add keys to change set as removed, don't add to clone
                    changeTrie.subtries.put(key, subtries.get(key)._nulledClone());
                } else {
                    // unchanged - reuse existing subtree for clone
                    clone.subtries.put(key, subtries.get(key));
                }
            }
            return clone;
        }
        private StateTrie _cleanAndClone() {
            if (value == null) { isPath = false; }
            StateTrie clone = new StateTrie();
            clone.value = value;
            clone.isPath = isPath;
            Iterator<Entry<String, StateTrie>> it = subtries.entrySet().iterator();
            while (it.hasNext()) {
                Entry<String, StateTrie> item = it.next();
                StateTrie subtrie = item.getValue()._cleanAndClone();
                if (subtrie == null) {
                    it.remove();
                } else {
                    clone.subtries.put(item.getKey(), subtrie);
                }
            }
            return isEmpty() ? null : clone;
        }

        public Map<String, Object> filter(PathTrie filter, boolean filterSecrets) {
            return filter.intersect(this, filterSecrets);
        }
    }
}
