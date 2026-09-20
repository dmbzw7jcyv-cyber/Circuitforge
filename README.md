# CircuitForge

A self-hosted virtual electronics lab: visual circuits, a syntax-highlighted code editor, bounded GPIO simulation, live pin inspection, serial output, and persistent projects. Designed for desktop and iPad with pointer-based wiring and component placement.

## Run

Node.js 24 recommended (22.13+ with node:sqlite required).

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000. No external runtime packages or network services are required. Development test dependency: jsdom. Production serves static ES modules with Node's HTTP server and SQLite.

## Use

- First visit opens a wired Arduino Blink circuit. Projects opens the dashboard and Arduino button and MicroPython Pico examples.
- Click a component in the palette, or drag it onto the workspace. One MCU per project. Drag component headings to reposition. Use the × button in any component header to remove it; the MCU can be deleted and replaced with another board.
- Click/tap one pin and then another to wire them. Escape cancels a pending wire. Select and delete a wire or component via its inspector or Delete key.
- Edit code and click Run; Pause preserves interpreter state, Reset clears state. Speed scales simulated time (0.25–4×). Editing circuit/code invalidates the current run. Sensor sliders may change during a run.
- Hold a button's PUSH surface to close its switch. Inspect current GPIO values in the Pin inspector tab.
- Edits autosave after 600 ms. The save label reports errors and allows retry. JSON export includes version, ID, name, description, language, code, component settings/positions, connections, and update time. Imports validate pin references and create a fresh project ID.
- Each browser gets a signed HttpOnly session cookie. Projects are isolated by session, not a shared global list. **This is not an account system**: no cross-device sign-in or cookie recovery. Export before clearing cookies; import on a second device. Keep the same SESSION_SECRET across restarts.

## Current simulation contract

This is a restricted source interpreter and ideal digital connectivity model, **not an AVR/RP2040/RP2350 emulator, C++ compiler, MicroPython VM, SPICE solver, or firmware uploader**. Unsupported statements cause a parser/runtime error; there is no execution through eval, Function, shell, or a native toolchain.

### Boards and components

| Component | Simulated behavior | Limits |
|---|---|---|
| Arduino Uno/Nano | Digital GPIO, input pull-up, analog reads, PWM duty | Shared GPIO abstraction, not cycle-accurate; pin subset shown on canvas |
| Pico/Pico 2 | Same GPIO abstraction, MicroPython subset | No chip-specific CPU/peripheral differences; exposed GPIO subset |
| LED | Brightness from anode logic/duty when cathode is grounded | No forward voltage, current, resistor requirement, damage or reverse-bias model |
| Resistor | Ideal conductive link, editable ohm metadata | Resistance does not affect voltage/current/brightness |
| Push button | Momentary ideal contact between pins 1 and 2 | No bounce or four-terminal package model |
| Potentiometer / analog sensor | Manually set normalized value (0–1023) when powered | No real voltage divider, temperature/light physics, sensor protocol or calibration |
| Mini breadboard | 60 usable tie points arranged as A–E / F–J rows across six columns | Each visible column-half connects in a group of five; colored lines are guides, not power rails |

Digital HIGH/LOW are normalized 1/0, not actual voltages. Board 5V/3V3 labels both supply logic HIGH. Resistors and wires union connected nodes; conflicting driven levels halt simulation, floating reads report an error instead of assuming zero. PWM brightness and analog values are normalized scalars, not time-varying waveforms. Analog reads use 10-bit normalized values on both board families. Uno/Nano PWM is restricted to D3/5/6/9/10/11. Pico PWM is normalized through the Arduino-style analogWrite subset; MicroPython PWM classes are not supported.

### Arduino-style C/C++ subset

- `void setup() { ... }`, `void loop() { ... }`
- Initialized int/bool/float/long/unsigned long/const declarations, assignments, numeric or string literals, `HIGH`, `LOW`, `LED_BUILTIN` (Uno/Nano D13), A0–A7 symbols
- Arithmetic `+ - * / %`, comparisons, boolean operators, unary `!`/`-`, `if/else`
- `pinMode(pin, OUTPUT|INPUT|INPUT_PULLUP)`, `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite(pin,0..255)`, `delay(milliseconds)`
- `Serial.begin`, `Serial.print`, `Serial.println` produce timestamped log entries. Each print call is a separate console entry; no serial input API or byte-level serial protocol.
- Explicit `pinMode(…,OUTPUT)` is required before output writes. Digital values must be 0 or 1.

Not simulated: preprocessor/includes, user functions, libraries, arrays, structs, pointers, casts, C for/while loops, interrupts, timers/millis/micros, pull-down modes, full C integer semantics/scoping/short-circuit behavior. Arithmetic uses JavaScript numbers. Both boolean operands are evaluated. Basic variables are in a single environment. Use simple statements and delay in repeated code; the instruction budget halts runaway loops. Serial retains the latest 200 entries.

### MicroPython subset (Pico/Pico 2)

```python
from machine import Pin
from time import sleep
led = Pin(15, Pin.OUT)
while True:
    led.value(1)
    sleep(0.5)
    led.value(0)
    sleep(0.5)
```

Supported canonical syntax: these imports, `Pin(number, Pin.OUT|Pin.IN[, Pin.PULL_UP])`, `pin.value()`/`pin.value(expr)`, `sleep(numeric_literal)`, `sleep_ms(integer_literal)`, `print(expr)`, `if condition:` and one top-level `while True:`. Pin constructors are setup declarations. `not` is translated for boolean expressions. Other Python syntax is rejected. No full Python runtime, `else`, arbitrary assignment, ADC/PWM classes, imports, exception handling, threads, or networking. Code is translated to the same restricted intermediate language.

## Architecture and extension points

- `public/model.js`: serializable, versioned circuit document, component registry, validation, immutable wiring/deletion operations, examples, ideal net solver. Add component pin definitions to the registry; extend validation and solver behavior with tests.
- `public/simulator.js`: tokenizer/parser → explicit AST → bounded deterministic interpreter. Tracks variables, instruction queue, wake time, GPIO mode/value, button state, and serial logs. `tick(ms)` advances only simulation time. No access to filesystem/network from source. Future native/WASM processor engines should implement an adapter around this state interface; retain the current explicit capabilities rather than silently interpreting more hardware.
- `public/app.js`: project/dashboard UI, SVG diagram, pointer wiring/dragging, syntax overlay editor, simulator controls, inspector and debounced sequential save queue. Built without a runtime framework.
- `store.js`: SQLite persistence, prepared queries, atomic document UPSERT, owner-scoped access. WAL journal. A future migration should introduce a schema-version table before changing the persisted representation.
- `server.js`: static asset allowlist, JSON API, input limits, signed random session cookies and same-origin write checks. No user source executes server-side.

For complex electrical simulation, add a separate netlist solver rather than extending ideal unions to claim current/voltage precision. For displays, sensors and ICs, declare each supported protocol/capability and render unsupported status until its behavior is implemented. Keep one simulation clock and add instruction budget tests for every interpreter extension.

## API

| Method | Path | Behavior |
|---|---|---|
| GET | /api/health | Liveness |
| GET | /api/projects | Current session's full project documents |
| GET | /api/projects/:id | Reopen one project |
| PUT | /api/projects/:id | Validate and upsert full project |
| DELETE | /api/projects/:id | Delete current session's project |

Limits: 100 components, 500 wires, 100k source characters, 1MB request/import. There is no multi-user collaborative editing. Within a browser, saves serialize; separate tabs use last-write-wins. Session cookies are bearer access to that session; do not share them. For Internet scale, add rate limiting, quotas, periodic database backups and an account/recovery system.

## Railway deployment

1. Publish this repository to your GitHub and connect it in Railway.
2. Deploy with the included Dockerfile and `railway.json`. The Docker build installs locked test dependencies, runs all tests, then removes dev dependencies.
3. Attach a persistent Railway volume mounted at `/data`. **Do not deploy the database on the ephemeral container filesystem.** Use one service replica with this SQLite volume.
4. Set `DATA_DIR=/data`, `NODE_ENV=production`, and a randomly generated `SESSION_SECRET` (at least 32 random bytes encoded as hex). Railway supplies PORT. Production refuses to start without a secret.
5. Generate an HTTPS domain. Health check is `/api/health`.
6. Create and rename a test project in the production UI; reload and reopen it. Redeploy/restart the service and reopen with the same cookie to confirm volume persistence. Back up `/data` using a SQLite-safe backup mechanism or Railway volume snapshots.

No credentials are included in this repository. `SESSION_SECRET` should not be rotated casually because changing it invalidates access cookies.

## Tests

`npm test` uses node:test for circuit validity, net propagation, button state, PWM bounds, analog sources, breadboard grouping, interpreter rejection, bounded execution, SQLite reopen, session isolation, HTTP validation, and DOM UI interaction flows (create/edit/save/reopen/duplicate/add/connect/delete/run/pause/reset). DOM tests use jsdom; they do not claim physical touchscreen or browser rendering coverage.

## Component appearance

`public/appearance.js` owns the top-view SVG diagrams, component bounds, and pin coordinates. Uno, Nano, Pico and Pico 2 have distinct proportions, PCB colors, USB sockets and chip packages. LEDs have leads and a translucent dome; resistors show value-derived color bands; buttons have an interactive plunger; potentiometers have a value-linked knob; breadboard contacts are drawn at their actual simulation connection points. The generic analog input uses a light-sensor-style visual but remains a manually controlled signal source.

These are simplified functional views, not manufacturing drawings or physical wiring references. Only exposed simulation pins are included; visual realism does not expand electrical fidelity. Existing saved circuits retain their IDs and connectivity and redraw with the new pin positions.
