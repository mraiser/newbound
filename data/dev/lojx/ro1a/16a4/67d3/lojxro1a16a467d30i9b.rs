// End a debug session (flow step debugger P3, lifecycle R4). The transition lives in debug_step (mode stop) so ONE
// function owns every lifecycle change: an idle session ends at once; a session with an owner (a running continue
// or a synchronous step) is marked stopping, the owner finishes the step in flight (cooperative - an op that is
// executing cannot be preempted; it is recorded exactly once), sees stopping at the step boundary and runs the
// terminal cleanup itself; this call waits up to 10 s for that acknowledgement. Idempotent: a stopped/reaped
// session answers ok with already:true (tombstones capped at 64 / 6 h).
super::debug_step::debug_step(session, "stop".to_string(), DataObject::new())