# The flow language - language description

The authoritative description of the flow language: the Case graph that
dev.flowdoc models and flowlang's interpreter (`Code::execute`) runs.

Provenance. dev.flowdoc and dev.flowedit3d cite the bench-era
`docs/flow3d-design.md` Part I for the language. That file was lost with the
archived newbound-bench repo. This text replaces it. Synchros S0 (2026-10)
rebuilt it from flowlang 0.3.39 (`src/case.rs`, `src/code.rs`) and dev.flowdoc.
It keeps the old Part I numbering those controls still cite: section 1.3 covers
operations (including the command-output rule, I-7), section 1.5 covers the
propagation loop, and step 3 of section 1.5 is the case-start rule. Where the
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
- **command** - calls `cmd` (`"lib:ctl:cmd"`). flowlang resolves it with
  `Command::new(lib, cmd)`, so the ctl segment is not consulted. The inputs
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
   can never fire (I-1, I-2) repeats forever, and the thread hangs: never run a
   stuck flow under `Code::execute`.

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
  fresh state. If no `nextcase` is reachable, the interpreter panics (I-4).
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
