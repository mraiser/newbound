// Timer target (flow step debugger P3, lifecycle R4) - the transition lives in debug_step (mode reap): idle
// sessions with no debug_* call and no step for 30 min end (tombstoned); a session with an owner is never unlinked
// under it - the owner's per-step heartbeat keeps an active continue alive without HTTP polls, and an owner whose
// heartbeat is older than 2 h (one op executing that long) is asked to stop and ends itself at its next boundary.
super::debug_step::debug_step(String::new(), "reap".to_string(), DataObject::new())