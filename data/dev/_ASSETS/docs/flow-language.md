# The flow language - language description

The authoritative description of the flow language: the Case graph that
dev.flowdoc models and flowlang's interpreter (`Code::execute`) runs.

Provenance. dev.flowdoc and dev.flowedit3d cite the bench-era
`docs/flow3d-design.md` Part I for the language. That file was lost with the
archived newbound-bench repo. This text replaces it. Synchros S0 (2026-10)
rebuilt it from flowlang 0.3.39 (`src/case.rs`, `src/code.rs`) and dev.flowdoc.
It keeps the old Part I numbering those controls still cite: section 1.3 covers
operations (including the command-output rule, I-7), section 1.5 covers the
propagation loop, and step 3 of section 1.5 is the case-start rule. Flow step
debugger P0 added section 1.5.4 (step semantics, frames, events and the
stepper fixtures). Flow step debugger P6 (2026-10, flowlang 0.3.40) moved the
stepper into the crate (`src/stepper.rs`); `Code::execute` is a continue-to-end
over it, and I-4 / a stuck case are errors, not a panic / hang. Where the
interpreter and this text disagree, the interpreter is the truth and this text
has the bug. Editor design (the bench doc's sections 3-7, still cited by section
number in the editors' comments) is not part of the language and is not
repeated here.

## Part I - The language

### 1.1 Flow commands and the case chain

A flow command's body is a Case. A Case may carry a `nextcase` (another Case),
which forms a chain. Execution starts at the root case with the command's
arguments (`args`) and ONE result object `out` that the whole chain shares.

- A `next` rule (section 1.5.1) abandons the current case and starts the next
  one with fresh state. `args` stay the same, and values already delivered to
  the return bar stay in `out` unless a later case overwrites them.
- The command returns `out` when a case ends normally or when a `terminate`
  rule fires.

### 1.2 Case

    { "input":    { <name>: Node, ... },  // the params bar  (wire source index -1)
      "output":   { <name>: Node, ... },  // the return bar  (wire dest index -2)
      "cmds":     [ Operation, ... ],     // ops: wires and synchros name an op by its index here
      "cons":     [ Connection, ... ],    // wires
      "syncs":    [ Synchro, ... ],       // OPTIONAL, absent = []  (section 1.5.3)
      "nextcase": Case }                  // OPTIONAL

- `input`, `output`, `cmds` and `cons` are required (the parser panics when one
  is absent). `syncs` and `nextcase` are optional.
- A local op's `localdata` is a full Case of the same shape, chain included.

### 1.3 Operations

    { "name", "type", "pos": {"x","y","z"}, "width", "in": {<name>: Node},
      "out": {<name>: Node}, "ctype"?, "cmd"?, "localdata"?,
      "condition"?: {"rule", "value"} }

- `name`, `type`, `pos` (all three axes, I-9), `width`, `in` and `out` are
  required.
- `pos` and `width` are layout only.

The `type` field selects one of these operations:

- **primitive** - a built-in from flowlang's primitive table, chosen by `name`.
- **command** - calls `cmd` (`"lib:ctl:cmd"`; editors write
  `lib:ctlId:cmdId`). flowlang resolves it with `Command::new(lib, cmdId)`,
  where the third segment is the command's record id, so the ctl segment is
  not consulted. The inputs
  are the call's arguments. Results map onto the op's outputs BY POSITION,
  not by name: a flow callee supplies its output-bar keys, and any other
  callee supplies its single key `a`. Terminal maps are unordered, so a
  command op should have exactly one output (I-7).
- **local** - runs `localdata`, an inline Case with its chain, as a nested flow
  whose args are the op's inputs. The local flow's `out` becomes the op's
  outputs. With no `localdata`, every output is null. `next` and `terminate`
  inside a local stay inside it (section 1.5.1).
- **constant** - `name` is the literal. `ctype` is one of int, decimal,
  boolean, string, object or array (anything else gives null), and every
  output gets the value. A constant never evaluates a condition (I-10).
- **persistent** - `name` is a key in the process-wide globals. With an input
  (at most one, I-6), the op stores that input first. Then every output reads
  the global, or null if it is unset. Globals outlive the call: a persistent op
  is shared, mutable state, which is why fixtures use globals with unique names.
- **match** - compares its single input with `name`, read as a `ctype`
  literal: int, decimal, boolean, string or null. Objects and arrays never
  match (I-5). The comparison result is the op's success flag for its
  condition.
- **undefined** - a placeholder. A wire into it marks it done.

### 1.4 Terminals and wires

**Node** (a terminal on an op or a bar):

    { "mode", "type", "x", "list"?, "loop"? }

- `mode`, `type` and `x` are required in practice (`Node::from_data` panics
  when one is absent).
- `mode` is `regular`, `list` or `loop` (section 1.5.2).
- `type` is the value-type label.
- `x` is the slot along the bar.
- A terminal's value is null until it is delivered.
- Terminal names are unique per side of an op or bar (I-3).

**Connection** (a wire):

    { "src": [index, name], "dest": [index, name] }

- The `src` index is an op or -1 (the params bar). The `dest` index is an op
  or -2 (the return bar).
- A wire carries one value, once.
- Every op input has exactly one incoming wire (I-1, fan-in 1). Outputs may
  fan out.

### 1.5 Execution: the propagation loop

For each case, in order:

1. **Fresh state.** Every op, wire and synchro of the case starts not-done.
   `next` re-enters here for the next case.
2. **Result.** `out` is the chain's shared result object (section 1.1).
   Terminals hold null until they are delivered.
3. **Case start.** Visit each op in index order. An input terminal is
   pre-marked delivered (value null) when its NAME is no wire's dest name
   anywhere in the case. The match is global and by name only, which is the
   I-1 sharp edge: an unwired input whose name is wired on some other op waits
   forever. The op runs now when every input is pre-marked (or it has none)
   AND it has no incoming synchro (section 1.5.3, rule 3). Note: flowlang
   stops pre-marking an op's inputs at its first awaited one, and terminal
   order is unspecified. So an op that mixes wired and unwired inputs may wait
   forever; only I-1-clean flows are defined.
4. **Wire pass.** Visit each wire that has not fired, in order. Its source is
   available if it is the params bar (value `args[name]`, or null) or an op
   that is done (value `result[name]`). An available wire fires:
   - Into the return bar, it sets `out[name]`.
   - Into an op, it delivers the input. If that completes the op's inputs and
     the src of every incoming synchro is done, the op runs immediately, so
     later wires in the same pass already see its outputs.
   - A second delivery to an op that has already run runs it AGAIN, which is
     another reason for I-1.
5. **Synchro pass** (section 1.5.3). Visit each synchro that has not fired.
   If its src is done, it fires, and its dest runs if dest is not done and is
   now ready.
6. **End test.** If the pass began with every wire and every synchro already
   fired, the case ends. Otherwise, repeat from step 4. A wire or synchro that
   can never fire (I-1, I-2) makes the case stuck. Since Flow step debugger P6
   `Code::execute` is a continue-to-end over the stepper (`flowlang::stepper`)
   and reports a stuck case as an error (`Err(CodeException::Fail)`) instead of
   hanging; earlier interpreters looped forever, so a stuck flow was never run.

**Running an op** (steps 3-5) means: evaluate its body (section 1.3, once per
element for list and loop, section 1.5.2), then its condition (section 1.5.1),
then mark it done with its result.

**Order.** The language specifies NO order among ops that are ready at the
same time. flowlang's index-order traversal is an implementation detail, not
a contract. Any ordering that a flow's outcome depends on must be a synchro
(section 1.5.3). This is the owner's ruling: nondeterministic order of ready
ops is acceptable, and timing that matters is stated with a synchro.

#### 1.5.1 Conditions

`condition: {rule, value}`. After the body runs, the op's success flag is
compared with `value`, and the rule fires when they are equal.

- For a match op, the success flag is whether it matched.
- For every other op, the success flag is true unless the body raised `fail`
  (a fail from a called command, or from a local's flow). That fail is
  absorbed into the flag: it does not abort the case.
- An op with no condition whose body fails completes normally, with whatever
  outputs it produced.

The rules:

- **next** - the case ends now, and execution continues at `nextcase` with
  fresh state. If no `nextcase` is reachable (I-4), the run ends with an
  error: since Flow step debugger P6 `Code::execute` returns
  `Err(CodeException::Fail)` instead of panicking.
- **terminate** - the flow ends now, and `out` as delivered so far is the
  result. Inside a local, only the local's flow ends; the local op completes
  with that partial `out`.
- **fail** - the flow ends with fail. Inside a local, the enclosing local op
  sees it as a success flag of false.
- **finish** - marks the flow finished. On a local op, this stops its list or
  loop iteration after the current pass.

#### 1.5.2 List and loop

- An input of mode `list` makes the op run once per element. The count is the
  length of the shortest list input, and non-list inputs pass whole each time.
- An output of mode `list` collects one value per iteration into an array. A
  non-list output keeps the last value.
- An output of mode `loop` feeds its value back into the input named by its
  `loop` field (I-8) for the next pass. With no list input, the op repeats
  until `finish`, so only a local op can end such a loop.
- With zero elements and no loop output, the body never runs: list outputs
  are `[]` and the others are null.
- A list or loop op is done only after its LAST iteration.

#### 1.5.3 Synchros

A **synchro** is a data-less edge between two operations of one case. It
means "src must finish before dest starts" and nothing else: it carries no
value and does not change dest's arguments. It is the one way a flow makes
execution order part of its meaning.

**Encoding.**

    Case.syncs: [ { "src": <op index>, "dest": <op index> }, ... ]

- `src` and `dest` index this case's `cmds`.
- The key is optional; absent means `[]`.
- It may appear on any Case: the root, any `nextcase`, and any local op's
  `localdata`.
- Editors (dev.flowdoc since Synchros S2) emit the key only when it is
  non-empty, so a body without synchros is unchanged byte for byte.

**Rules.** Rules 1-7 are numbered here; the diagnostic codes S-1 and S-2 are
in section 1.6.

1. **Endpoints.** `src` and `dest` are distinct ops of the SAME case. There
   are no params-bar (-1) or return-bar (-2) endpoints: params are available
   at case start, and a case already runs every non-stalled op before it
   ends. A synchro that breaks this rule is inert at runtime (it fires at
   once and gates nothing) and is diagnosed as S-1.
2. **Readiness.** An op is ready when every input it awaits has been
   delivered AND the src of every incoming synchro is done. A ready op runs
   exactly once: the synchro path checks that the op is not done (the wire
   path's double-delivery re-run in section 1.5 step 4 does not extend to
   synchros).
3. **Case start** (amends section 1.5 step 3). An op runs at case start only
   if it awaits no input AND has no incoming synchro. Which inputs are
   awaited is unchanged.
4. **Firing and termination.** A synchro fires in the synchro pass once its
   src is done. If that leaves dest ready, dest runs then. dest can also run in
   the wire pass when its last input lands after its synchros' sources are
   done. A case ends only when every wire AND every synchro has fired.
5. **Early exit.** If the case ends (`next`, `terminate` or `fail`) before
   dest is ready, dest never runs. In particular, a src whose own rule ends the
   case never becomes done. Synchros are per case: `next` starts the next case
   with fresh state, including its own `syncs`.
6. **Composite ops.** A list- or loop-mode src is done after its LAST
   iteration, so dest sees every iteration. A local op as src or dest counts
   as the whole op: as src, it is done when its local flow has finished; as
   dest, its local flow starts only after src. Synchros inside a `localdata`
   order only that case's ops.
7. **Acyclicity.** Wires (op -> op) plus synchros must form an acyclic graph.
   A cycle through them stalls the case: it hangs at section 1.5 step 6.
   Diagnostic I-2 covers wires and synchros together.

**Compatibility.**

- flowlang 0.3.39 and later honor `syncs` (flow PR #8, Synchros S1).
- flowlang 0.3.38 and earlier ignore Case keys they do not know, so an older
  runtime or peer runs a `syncs` body UNSYNCHRONIZED, without any error.
- dev.flowdoc before Synchros S2 emitted only input, output, cmds, cons and
  nextcase, so an editor save stripped `syncs`.

**Fixtures** (scratch.skills; `synchro_s0_check` runs them all). Each fixture
uses its own persistent globals (`synchro_s0_fixture_*`). The checker presets
them, so every run is self-contained.

| fixture | shape | honors syncs (>= 0.3.39) | ignores syncs (<= 0.3.38) |
|---|---|---|---|
| synchro_s0_a | persistent A stores params.v; persistent B (no input) reads it; syncs 0->1 | r = "fresh" (v) | r = "previous" (B ran at case start) |
| synchro_s0_a_nosync | same body with no syncs (the control) | r = "previous" | r = "previous" |
| synchro_s0_b | a match src fires `next`; dest is a persistent marker write; syncs 0->1 | marker "untouched", r "case2" | marker "dest_ran", r "case2" |
| synchro_s0_c | list-mode persistent src over "x1,x2,x3"; reader dest; syncs 1->2 | seen "x3", iterations [x1,x2,x3] | seen "previous" |
| synchro_s0_d | W -> local L (copies d to d2) -> reader R; syncs 0->1, 1->2 | l "fresh", r "fresh" | l and r "previous_d" |
| synchro_s0_e_STALLS | wire 1->0 plus synchro 0->1: a cycle | STALLS - never run under Code::execute | (not run) |

Verified results:

- **flowlang 0.3.38:** `synchro_s0_check` returned runtime "ignores_syncs";
  every synced fixture was "unsynced" and the control was "both".
- **flowlang 0.3.39:** it returned runtime "honors_syncs"; a, b, c and d were
  "synced", the control was "both", and fixtures_detect_ordering was true.
- **Both:** syncs round-tripped through write_flow_body/read_flow_body on all
  six bodies, and (e) was cycle-checked statically: it has a cycle only with
  its synchro.

So the same bodies give different results depending only on whether `syncs`
is honored. A synchro changes an outcome.

#### 1.5.4 Step semantics (the stepper)

Flow step debugger P0 wrote this down from flowlang 0.3.39 (`src/code.rs`,
`src/command.rs`) and the parent plan item's model. It defines what one STEP of
a flow is, so a stepper can run a flow one step at a time, and so that
`continue` gives exactly what `Code::execute` gives. Sections 1.5 to 1.5.3
remain the language. This section restates them as a ready-set machine and
adds what the propagation loop leaves implicit: frames, iterations and events.

**Model.** A stepper is a ready-set scheduler, not a copy of the sweep. At
every point some items are READY, and a step takes one of them. The language
gives no order among ready items (section 1.5, Order). Any pick is a valid
run, and an outcome that depends on the pick is a missing synchro. The
DEFAULT pick follows flowlang's sweep (below), so a run where the user never
overrides it is the same run as `Code::execute`.

**State.** Plain ndata, kept apart from the graph, which is never mutated.
State is a frame stack. Each frame holds:

- its kind (root, local or command);
- its Case chain;
- the index of its current case;
- its `args` and its `out`;
- its finish flag;
- for the current case: fired wires, fired synchros, delivered inputs (with
  their values), done ops and their results, and the op in progress (with its
  iteration index).

Values recorded in events are deep copies, because ndata handles are shared.

**Ready set** (top frame, current case):

- **Wire** `k` is ready when it has not fired AND its src is the params bar
  (value `args[name]`, or null) or a done op (value `result[name]`).
- **Synchro** `k` is ready when it has not fired AND its src op is done. A
  synchro whose endpoints break rule 1 (S-1) is ready at once and gates
  nothing.
- **Op** `i` is ready when it is not done AND every awaited input has been
  delivered AND the src of every valid incoming synchro is done. Readiness
  reads src DONE, not synchro fired: the wire path can run dest before the
  synchro itself fires (rule 4). Rule 3, the case-start rule, follows from
  this, because no src is done at case start.
- **Awaited.** An input is AWAITED when its name is the dest name of some
  wire anywhere in the case, the return bar included. This is flowlang's
  global by-name match (section 1.5, step 3). It is kept for parity: an
  unwired input that shares a name with any wired terminal, even a return-bar
  key, waits forever (I-1). Every input that is not awaited is pre-delivered
  as null at `seed`. flowlang stops pre-marking at an op's first awaited input
  in HashMap order, which is random, so a mixed op may hang under it; the
  stepper pre-marks all of them. Only I-1-clean flows are defined.
- **Re-arm.** A delivery into an op that is already done, which makes its
  inputs complete again, makes it ready again. This is flowlang's re-run
  (section 1.5, step 4), and it is reachable only with fan-in greater than 1
  (I-1).
- **Atomic ops.** An op in progress is atomic within its case. While its
  frame is open or its iterations run, nothing else in its case may be picked
  until it is done or a rule fires. flowlang runs it synchronously, and rule 6
  counts a composite op as the whole op. Steps inside it are sub-steps.

**Steps and events.** Each step emits one event. Every event carries `seq`,
`frame` (the path from the root: `[[op, iter], ...]`, where `[]` is the
root), `case` (the chain index) and, where it applies, `op`, `wire` or `sync`
indices. The editor derives its `d<n>_op<i>` / `fx_d<n>_wire_<k>` keys from
these fields.

| event | when | payload |
|---|---|---|
| `enter` | a frame is pushed: the root at start, a local op, or a flow command op | kind, op, iter, lib/cmd (command), args |
| `seed` | a case starts with fresh state (start, or after `next`) | pre-delivered inputs `[[op,name]]`, initial ready set |
| `deliver` | a wire fires | wire, value, dest (`out[name]` set, or op input delivered) |
| `sync` | a synchro fires | sync, inert (S-1) |
| `iter` | an iteration of a list/loop op begins | op, i, n (null for an open loop), the iteration's inputs |
| `eval` | an op's body ran (the whole op, one iteration, or a closing frame's result) | op, iter, in, out, b (success flag), rule fired or null, done |
| `leave` | a frame is popped | outcome out, terminate or fail, out |
| `next` | the effect of a fired `next` rule | from case, to case |
| `terminate` | the effect of a fired `terminate` rule | op |
| `fail` | the effect of a fired `fail` rule | op |
| `finish` | the effect of a fired `finish` rule | op (sets the frame's flag and stops nothing) |
| `stall` | the ready set is empty but wires or synchros are still unfired | unfired wires, synchros, never-ready ops |
| `done` | the root frame has ended | out, or fail |
| `error` | the run cannot continue | code (I-4, panic, absent-output), msg |

- A delivery and the evaluation it enables are separate steps.
- A rule's effect is the step after the `eval` that reports it.
- `stall` and `error` always stop the run. They replace flowlang's hang (a
  stuck flow, section 1.5 step 6) and its panics (I-4, and absent outputs,
  below).
- A step budget bounds `continue`. Running it out PAUSES the session, so an
  open loop without finish cannot run away. It is not an event.

**End of a case.** The case ends when the ready set is empty.

- If every wire and synchro has fired, the case ended normally. In a root
  frame that means `done` with `out`; in a nested frame, `leave` with outcome
  out. Ops that never became ready are named in that event. flowlang ends such
  a case silently.
- Otherwise the result is `stall`.
- flowlang reaches the same point: it ends the case after a pass in which
  every wire and synchro had already fired. Because it runs ops the moment
  they become ready, no ready op is ever left over.

**Case chain and rules** (section 1.5.1):

- `next` abandons the case. The frame moves to `nextcase` and emits `seed`
  with fresh state. `args` and `out` carry over. A `next` with no next case is
  `error` I-4 (flowlang panics: `nextcase.unwrap()`).
- `terminate` ends the frame's flow with `out` as delivered so far. In the
  root frame that is `done`. In a local or command frame, `leave` with outcome
  terminate: the enclosing op completes with that partial `out` and a success
  flag of TRUE.
- `fail` ends the frame's flow with fail. In the root frame that is `done`
  with fail (`invoke_command` reports status err). In a local or command
  frame, `leave` with outcome fail: the enclosing op gets a success flag of
  false and an EMPTY result, and its own condition decides what happens next.
  A fail crosses a frame only when the enclosing op re-raises it with its own
  `fail` rule (fixture nested_fail).
- `finish` sets the CURRENT frame's finish flag and stops nothing. A local
  op reads its frame's flag after each iteration: when it is set, the op stops
  iterating after that pass and keeps that pass's outputs. A root frame's flag
  and a command frame's flag are discarded, so finish never crosses a command
  op. A `finish` rule on an op's own condition sets the ENCLOSING frame's
  flag, so it never stops that op's own iteration.
- **Early-exit race.** `next`, `terminate` and `fail` end the case at once,
  and unfired wires never fire. A return-bar wire that was ready at the same
  time as the exiting op may or may not have fired. That is a matter of order,
  and rule 1 allows no synchro onto a bar, so the language cannot pin it.
  Keys downstream of the exiting op are always absent. Keys that were ready
  alongside it are order-dependent, both in a terminated `out` and in what a
  case leaves behind for the next one. flowlang 0.3.39 shows it: one graph,
  `params.a` wired to a terminating match and to `out.first`, returns `{}` or
  `{first}` depending only on the order of `cons`. A flow whose partial `out`
  matters must not rely on it.

**Frames.**

- **local**: `enter` with args = the op's inputs for this iteration (each
  list input contributes its element). The body is `localdata`, and its chain
  runs inside the frame, so `next` stays inside. On `leave`, the frame's
  `out` becomes the op's result, with its outcome as above. A local with no
  `localdata` opens no frame: it is one `eval` with every output null and
  b = true.
- **command, flow callee**: `enter` with args = the op's inputs passed raw.
  There is no cast_params; that happens only at the top, in app.app.exec.
  There is no check_auth either: the parent command's security is the gate
  (owner ruling). `cmd` is `lib:ctlId:cmdId`, and flowlang resolves it with
  `Command::new(lib, cmdId)`, so the callee may be in any library (fixture
  flow_op). The body is the callee's SAVED flow. On `leave`, its `out` maps
  onto the op's outputs BY POSITION (I-7), and outcomes are as for a local,
  except that finish is discarded.
- **command, rust/python callee**: no frame. It is one opaque `eval`, and
  its single key `a` maps onto the op's one output. It never fails: the
  generated rust wrapper turns a panic into `{a: {status: "err", msg}}`, and
  b stays true.
- **Absent outputs.** Reading an output key that the op's result lacks
  panics flowlang (DataObject::get_property). This happens after a frame
  terminated or failed before delivering the key, after a failed command op,
  when a flow callee never delivered its output, or with an `undefined` op,
  which has no result at all. The stepper reports `error` (absent-output)
  instead.

**Iterations** (section 1.5.2):

- An op with list inputs or a loop output runs as iterations. Each iteration
  is `iter`, then its body: one `eval`, or `enter` ... `leave` and then
  `eval`.
- The condition is evaluated PER ITERATION. A rule that fires on iteration k
  takes effect at once, and the op never becomes done.
- After the last iteration the op is done; that `eval` carries done and the
  collected outputs. The last iteration is reached when the shortest list
  runs out, or for a local op, when its frame's finish flag is set.
- With list inputs of length 0 and no loop output, there is a single `eval`
  with 0 iterations: no body, no condition, list outputs `[]`, the others
  null.
- A loop output with an empty list input panics flowlang (it indexes element
  0); the stepper reports `error`.
- A loop op with no list input ends only through its local frame's finish
  flag. A non-local open loop never ends, so the step budget pauses it.

**Default pick** (sweep order, so that `continue` matches `Code::execute`):

1. At `seed`, the ops ready at case start, in index order.
2. Then wire passes: the next ready wire in index order from the pass cursor.
3. Then the synchro pass: the next ready synchro in index order.
4. Then a new wire pass, and so on.
5. An op made ready by the step just taken is picked next, before the pass
   continues. flowlang runs it inside the pass.

A user pick does not move the pass cursor. Parity means that with no
overrides the run yields the same result and side effects as `Code::execute`
on the same body and args. This is checked by `flowstep_p0_check`, below.

**Fixtures** (scratch.skills; each fixture's desc states its expected
outcome). The callees are `scratch.skills.flowstep_p0_rust_callee` and
`flowfixtures.callees.wrap`, which is in another library on purpose.
`flowstep_p0_check` checks every safe fixture in three ways:

- It runs the fixture through `dev.code.invoke_command` (the real
  `Code::execute` path) and requires the EXACT result: no missing keys and no
  extra keys.
- It re-runs the saved body under `Code::execute` in three other sweep
  orders: cons reversed, cmds reversed (indices remapped), and both. This is
  an order probe, because a result that depended on the pick would differ
  between them. The probe was confirmed to tell the race above apart.
- It scans the body for I-1, I-2 and I-4, and the body must be clean.

The I-4 fixture and the two stuck fixtures are scanned statically and NEVER
executed.

| fixture | what it pins | expected |
|---|---|---|
| flowstep_p0_list_loop | list in/out, loop output feeding an input, zero iterations | `{mapped:[11,12,13,14], sum:10, empty:[]}` |
| flowstep_p0_local_next | `next` inside a local stays inside; synchro after a local | a=1: `{r:"one", after:"outer_done"}`; a=2: `{r:"other", after:"outer_done"}` |
| flowstep_p0_terminate | root terminate; key downstream of the exit absent; not a fail | a=stop: `{}` (status ok); a=go: `{after:"after"}` |
| flowstep_p0_nested_fail | fail two locals deep, re-raised once, caught by `next` | a=bad: `{r:"caught"}`; a=good: `{r:"passed"}` |
| flowstep_p0_finish_loop | finish inside a local stops its loop after that pass (open loop with guard list; list loop) | `{count:5, seen:["a","b","STOP"]}` |
| flowstep_p0_persistent | persistent read, write, read ordered by synchros | preset "previous", v=fresh: `{before:"previous", w:"fresh", r:"fresh"}` |
| flowstep_p0_rust_op | rust command op (opaque eval, key `a`) | a=x: `{r:"rust:x"}` |
| flowstep_p0_flow_op | flow command op in another library; callee fail = flag false | a=x: `{r:"x:flow"}`; a=fail: `{r:"callee_failed"}` |
| flownext_probe | three-case chain (reused) | a=1/2/x: `{r:"one"/"two"/"three"}` |
| flowstep_p0_i4_next_last_PANICS | `next` in the last case | stepper: `next` 0->1, then `error` I-4 |
| flowstep_p0_i1_unwired_STALLS | input awaited by name, no wire targets it | stepper: op 0 runs, then `stall` {wires:[2], ops:[1]} |
| flowstep_p0_i2_cycle_STALLS | wire cycle | stepper: `stall` {wires:[0,1,2], ops:[0,1]}, nothing evaluated |

Verified on flowlang 0.3.39: `flowstep_p0_check` returned ok with 18 passed
and 0 failed. That is 15 runs, each giving the same exact result under
invoke_command and all four sweep orders with a clean static scan, plus 3
static detections.

**Implementation (P1, dev.flowstep).** The stepper is built for one frame:

- `step(state, pick)` runs one step and returns `{state, event, ready, default, ended}`.
  To start, pass `state = {body, args}`. A pick of `{}` takes the default
  pick. A `{kind, index}` pick that is not ready is refused, and the state
  comes back unchanged.
- `run(body, args, policy, budget)` continues a run to its end. The policy is
  default, first, last or `random:<seed>`.
- `validate(body, args, events)` is the validity checker. It is a separate
  model of these rules, not the stepper's code.
- `parity(lib, ctl, cmd, args, presets, policy)` compares a run with
  Code::execute. It compares the result envelope and every persistent global
  the flow can reach. A body with a static I-1, I-2 or I-4 finding is never
  run under Code::execute.

In P1, local ops and command ops were single `eval` steps whose inner flows ran
to completion on the same machine. P2 (below) opens those inner runs as frames.

Two decisions:

- **No re-run.** A second delivery to an op that has already run is reported
  as I-1 on the `deliver` event, and the op is not run again. flowlang would
  run it again.
- **Values are shared handles, as in flowlang.** Each step copies only the
  stepper's own bookkeeping (fired and done flags, delivered-input maps, `out`,
  the cursor). Values stay shared, so in-place primitives (set, push,
  push_all, remove) keep parity. Fixture `flowstep_p1_alias` pins this. Event
  values are deep-copied snapshots. Because of this, `validate` checks scalar
  values strictly, but checks only the kind of a container (object or array).
  A shared container that changed in place after it was recorded is listed in
  `alias_notes`, not reported as a violation. Exact values are checked by
  parity instead.

Acceptance check: `scratch.skills.flowstep_p1_check(home)`. It ran against
the hot-reloadable mirror `scratch.flowstep`, which has the same code as
dev.flowstep. dev is rooted in newbound_core, so dev.flowstep only goes live
after a host rebuild and restart. The check passed 27 of 27 items:

- every safe P0 fixture and `flowstep_p1_alias`, each with default-pick parity
  plus 8 other pick policies that keep parity and validity;
- the synchro fixtures a, b, c and d with their stated results. The control,
  `a_nosync`, stays valid and gives both "previous" and "fresh" across picks;
- I-4, which ends in an `error` event after `next` 0->1;
- the i1, i2 and synchro_s0_e stuck fixtures, which end in `stall` with the
  stated wires and ops under every policy;
- fan-in 2, where the op runs once and I-1 is reported;
- a pick that is not ready, which is refused.

In total, 1838 steps were validated with 0 invalid traces.

**Implementation (P2, dev.flowstep: frames and step modes).** The stepper now
runs a frame stack:

- The state is `{body, frames, seq}`. `frames[0]` is the root, and only the top
  frame steps. Each frame holds its own Case chain (`body`), its `path`
  (`[[op, iter], ...]`, where iter is null for an op that does not iterate), and
  the P1 per-case bookkeeping. It also holds `inprog`, the op in progress.
  While an op is in progress, its frame's ready set is `[{kind: auto}]`,
  because the op is atomic.
- A local op with `localdata`, or a command op whose callee's lang is `flow`,
  pushes a frame when it is picked. The callee may be in any library. The args
  are passed raw, and permission is not checked again, because the parent call
  is the gate. The steps are `enter`, then the child's own steps, then `leave`
  (outcome ok, terminate or fail), then the op's closing `eval`
  (`from_frame: true`). A fail becomes b = false and an empty result at the
  caller's condition. Command outputs map by position (I-7).
- A list or loop op runs as `iter` steps. Each `iter` is followed by its body:
  one `eval` (with `iter: k`), or `enter` ... `leave` and then the closing
  `eval`. The eval for the last iteration carries `done`, the collected `out`,
  `iters`, and that iteration's own `iter_out`. Only a local frame's finish flag
  ends a loop early. A finish rule on the op's own condition in an earlier
  iteration is reported as `finish_fired`. Its effect waits for the op's final
  eval, so `eval.rule` is non-null exactly when its effect is the next step.
- A rust or python command op is still one opaque `eval`. A `stall` or `error`
  in any frame ends the whole run. The depth limit is 64 frames.
- `drive(state, mode, pick, target, budget)` gives the step modes:
  - **into**: one step.
  - **over**: one step. If that step opened a unit (pushed a frame, started an
    op in progress, or began an iteration), continue until the unit closes.
    For a frame, that means its `leave` and then the closing eval.
  - **out**: finish the innermost open unit. If the top frame has an op in
    progress, that op is the unit. Otherwise the top nested frame is the unit,
    up to the enclosing op's closing eval. In the root, with nothing in
    progress, out runs to the end.
  - **run_to**: continue until the next default pick is
    `target {kind, index[, frame][, case]}`. It is a breakpoint: it stops
    BEFORE that item runs.
  - **continue**: run to the end.

  After the first step, every step takes the default pick. So wherever a step
  opens a unit, **over == into followed by out**.
- `validate` models the frame stack independently. enter pushes the callee
  body, leave pops into the closing eval, and iteration inputs, loop feedback,
  collected outputs and the last-iteration test are derived again.

Acceptance check: `scratch.skills.flowstep_p2_check(home)`. Against the mirror
`scratch.flowstep`, it passed 10 of 10:

- the P1 regression, `flowstep_p1_check`, 27 of 27, with 3373 steps validated
  and 0 invalid traces. These now include the frame and iteration events;
- 8 nested runs: list_loop, local_next a=1 and a=2, nested_fail bad and good,
  finish_loop, and flow_op x and fail. Each kept parity in 72 parity runs (9
  pick policies each), reached its expected depth (nested_fail 3, the others 2),
  and its list/loop ops iterated;
- over == into + out at all 20 unit-opening points, with the same canonical
  state hash and the same step count;
- the mode checks for run_to, out and continue.

### 1.6 Invariants and diagnostics

These are the codes dev.flowdoc reports. They are diagnostics, never
rejections: an editor must be able to open a broken flow to fix it.

| code | invariant |
|---|---|
| I-1 | each op input has exactly one incoming wire (fan-in 1); see section 1.5 step 3 |
| I-2 | wires (op -> op) plus synchros are acyclic; a cycle hangs or stalls the case |
| I-3 | terminal names are unique per side of an op or bar |
| I-4 | a `next` rule needs a `nextcase` later in the chain |
| I-5 | a match op has exactly one input and a scalar ctype |
| I-6 | a persistent op has at most one input |
| I-7 | a command op has exactly one output (outputs are mapped by position) |
| I-8 | a loop output's `loop` names an input of the same op |
| I-9 | `pos` has x, y and z |
| I-10 | a condition on a constant is dead |
| S-1 | a synchro endpoint is not one of two distinct ops of this case (inert at runtime) |
| S-2 | a synchro is already implied by a wire path, or is a duplicate (info) |
