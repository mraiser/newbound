// The full view of a debug session (flow step debugger P3): cursor/base/length of the tape, the current event,
// ready set and default pick, ended, depth, running (a continue thread) and its last_run, the state hash next to
// the hash recorded on the tape, breakpoints, branch records, side-effecting steps, persistent globals and the
// current stepper state copy (graph bodies as "$body:N" refs). Works while a continue is running.
super::debug_step::debug_step(session, "state".to_string(), DataObject::new())