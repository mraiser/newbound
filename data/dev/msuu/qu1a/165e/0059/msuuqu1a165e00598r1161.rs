// The case path of ONE ordinary run (R5). No debug session, no tape, no
// sentinel nextcase, no 10k debugger budget: dev.flowstep.run_flow drives
// flowlang's own stepper (the one semantics Command::execute runs) to the
// end and observes it. The path is COMPLETE by construction - one segment per
// ROOT case (nested frames never enter it), closed by the root's next events
// and the terminal event - and each segment's ms/us is monotonic wall time
// measured at the execution boundary (nested work is attributed to the root
// case it ran under). result is THE mapping: app.app.exec's auth and
// format_result on ok/terminate; fail/stall/I-4/panic/budget name themselves
// (flow_end). Step budget = the ordinary run's (1,000,000 steps); running out
// is an explicit budget error, never a truncated success. No events kept.
crate::dev::flowstep::run_flow::run_flow(lib, ctl, cmd, args, 0, 0, nn_sessionid)