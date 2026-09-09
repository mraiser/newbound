#![allow(non_camel_case_types, unused_variables, unused_imports, dead_code)]
pub use ::ndata::dataobject::DataObject;
pub use ::ndata::dataarray::DataArray;
pub use ::ndata::databytes::DataBytes;
pub use ::ndata::data::Data;

pub mod agent {
    pub mod agent {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod llm {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn ask_llm(prompt: String, system_prompt: Data) -> String {
            let mut d = DataObject::new();
            d.put_string("prompt", &prompt);
            d.set_property("system_prompt", system_prompt);
            ::flowlang::rustcmd::RustCmd::new("rjuoqv19e8fc5c83ft4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn tool_loop(prompt: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("prompt", &prompt);
            ::flowlang::rustcmd::RustCmd::new("lnmvtl19edbeb72a7tc3a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn chat_llm(messages: DataArray, tools: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_array("messages", messages);
            d.put_array("tools", tools);
            ::flowlang::rustcmd::RustCmd::new("ytohmk19f70b2c09ck7ce2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn claude_code(messages: DataArray, tools: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_array("messages", messages);
            d.put_array("tools", tools);
            ::flowlang::rustcmd::RustCmd::new("mqghlt1a00a71c647q1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod plugin {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn control_query(message: String, context: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("message", &message);
            d.put_object("context", context);
            ::flowlang::rustcmd::RustCmd::new("innxiu19ebbb8efe6yfdf").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn list_tools() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("sroyxx19ebde8708fk14aa").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn describe_command(command_name: String, lang: String, returntype: String, groups: String, params: DataArray, imports: String, code: String, current_description: String) -> String {
            let mut d = DataObject::new();
            d.put_string("command_name", &command_name);
            d.put_string("lang", &lang);
            d.put_string("returntype", &returntype);
            d.put_string("groups", &groups);
            d.put_array("params", params);
            d.put_string("imports", &imports);
            d.put_string("code", &code);
            d.put_string("current_description", &current_description);
            ::flowlang::rustcmd::RustCmd::new("ktoprh19ec10b7907k1b87").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod scratch {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn eval_pshkms19ee68b2a1ct46() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ukvisj19ee68b2a21o48").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod agentloop {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod agentprompt {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod memory {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod archivist {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn log_turn(venue: String, ask: String, reply: String, tools: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("venue", &venue);
            d.put_string("ask", &ask);
            d.put_string("reply", &reply);
            d.put_string("tools", &tools);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("zktsrl19fb904ad42r2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn consolidate() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lwzzvz19fb904b9f0m4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn queue_status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("grkhrm19fb91df28dj1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remember(lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("domain", &domain);
            d.put_object("entry", entry);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("kkjzwq19fec41bc01j1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn promote(lib: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("ovppsz1a001b4abacu1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn seed_export(domains: String, path: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("domains", &domains);
            d.put_string("path", &path);
            ::flowlang::rustcmd::RustCmd::new("wjrzko1a001b4c938j3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn bootstrap(path: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("path", &path);
            ::flowlang::rustcmd::RustCmd::new("qxinhl1a001b4d45ei5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recall(query: String, domains: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("query", &query);
            d.put_string("domains", &domains);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("jwluwr1a0063833d7g1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn adjudicate(lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("domain", &domain);
            d.put_object("entry", entry);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("ytjnql1a006791e27h1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn epistemic_work() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ixhqrg1a0068b1a0cx1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn decay(lib: String, domain: String, claim: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("domain", &domain);
            d.put_string("claim", &claim);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("mttpgg1a0068b31e0u3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn reverify(limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("xknmpg1a01a30b0bdw1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn connect(subject: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("subject", &subject);
            ::flowlang::rustcmd::RustCmd::new("slxnyn1a01a32718ar1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn wonder() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("thpngr1a01a328e34q1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod chat {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn upload(filename: String, data_b64: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("filename", &filename);
            d.put_string("data_b64", &data_b64);
            ::flowlang::rustcmd::RustCmd::new("sspmvm1a039233859t28").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod askrow {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod describebtn {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod prompts {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod executive {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn start() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qosmvt1a005283299g2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stop() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ivhzuq1a005289448q4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("posxgg1a005289fd4u6").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn perceive(perception: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("perception", perception);
            ::flowlang::rustcmd::RustCmd::new("rstxhp1a00528ab29h8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_drive(acts_per_hour: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("acts_per_hour", acts_per_hour);
            ::flowlang::rustcmd::RustCmd::new("yhmiqo1a0068b5d24m5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn salience_log() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pqphsl1a0069ec4b0j1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn consolidate_room(min_quiet_s: i64, window: i64, budget: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("min_quiet_s", min_quiet_s);
            d.put_int("window", window);
            d.put_int("budget", budget);
            ::flowlang::rustcmd::RustCmd::new("qimijq1a01a19edbdl1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod sensor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn start() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("spjnyl1a00643ca37w2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stop() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mlmloh1a00643d901g4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("shvpqu1a00643e6b2p6").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn system_sense() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("huqsxm1a01a171a3fv1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn git_sense() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tlurvg1a0245e69c0t1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod model {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn salience(perception: DataObject, context: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("perception", perception);
            d.put_object("context", context);
            ::flowlang::rustcmd::RustCmd::new("gkrolu1a007e29aaeq2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn service_status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("smkzti1a007e309a2z4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn curriculum_export(path: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("path", &path);
            ::flowlang::rustcmd::RustCmd::new("uvwngs1a007e317dfx6").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn bootstrap() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mmgqil1a007f2ef9dz1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train_status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qmlyql1a00b6e9588w1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_settings() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pvstyk1a00b6edc7fo3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_setting(key: String, value: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("key", &key);
            d.put_string("value", &value);
            ::flowlang::rustcmd::RustCmd::new("snntws1a00b6eeefbp5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn promote_pointer() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("rvkipx1a00b6f02c0y7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn metrics() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("xwjiht1a00b8b4d59o1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn service_stop() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tqqiiv1a00f530e92n1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn user_promote() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pigtxk1a01099f7fby1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn user_rollback() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hjuwvn1a0109a1288u3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn persona_rederive() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("wwhrxv1a01124a788x1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn persona_read() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("uwlztr1a0113e5c0fn1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn persona_write(content: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("content", &content);
            ::flowlang::rustcmd::RustCmd::new("pyxiiz1a0113e7d1eu3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn import(name: String, source: String, backend: String, anchor: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("source", &source);
            d.put_string("backend", &backend);
            d.put_string("anchor", &anchor);
            ::flowlang::rustcmd::RustCmd::new("zszomo1a017741685j1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn models() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("yjmwrj1a0177498a8v1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn model_remove(name: String, purge: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_boolean("purge", purge);
            ::flowlang::rustcmd::RustCmd::new("ggojst1a01774ad4dg1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn resources() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qzikks1a01776d049o1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_add(name: String, source: String, kind: String, format: String, holdout_every: i64, mode: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("source", &source);
            d.put_string("kind", &kind);
            d.put_string("format", &format);
            d.put_int("holdout_every", holdout_every);
            d.put_string("mode", &mode);
            ::flowlang::rustcmd::RustCmd::new("srzlok1a0178434d1k1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_list() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("iklvto1a017845e1ar1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_inspect(name: String, peek: i64, verify: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_int("peek", peek);
            d.put_boolean("verify", verify);
            ::flowlang::rustcmd::RustCmd::new("uvqhnt1a0178473cbm1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_snapshot(name: String, snapshot_name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("snapshot_name", &snapshot_name);
            ::flowlang::rustcmd::RustCmd::new("jimxoz1a0178489a2h1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_derive(name: String, out_name: String, transform: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("out_name", &out_name);
            d.put_string("transform", &transform);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("oopiwl1a01784a023z1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_remove(name: String, purge: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_boolean("purge", purge);
            ::flowlang::rustcmd::RustCmd::new("rvjoug1a01787534du1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn adapter_derive(name: String, dataset: String, base: String, targets: String, rank: i64, steps: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("dataset", &dataset);
            d.put_string("base", &base);
            d.put_string("targets", &targets);
            d.put_int("rank", rank);
            d.put_int("steps", steps);
            ::flowlang::rustcmd::RustCmd::new("uglrzs1a017b4932dm1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn adapter_apply(name: String, on: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_boolean("on", on);
            ::flowlang::rustcmd::RustCmd::new("rzrtvh1a017b4aa9ez1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn adapters() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("zwhrqp1a017b4c175s1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn adapter_delete(name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("rpszoz1a017b4d8cez1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recipe_author(name: String, base: String, mix: String, posture: String, steps: i64, lr: String, evals: String, notes: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("base", &base);
            d.put_string("mix", &mix);
            d.put_string("posture", &posture);
            d.put_int("steps", steps);
            d.put_string("lr", &lr);
            d.put_string("evals", &evals);
            d.put_string("notes", &notes);
            ::flowlang::rustcmd::RustCmd::new("goumpq1a01926744cg1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recipe_clone(name: String, from: String, edits: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("from", &from);
            d.put_object("edits", edits);
            ::flowlang::rustcmd::RustCmd::new("jnhhkw1a01926c03eu1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recipes() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("nonruq1a01926d805k1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recipe_remove(name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("wyhpqs1a01926eea0z1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn experiment(name: String, control: String, variant: String, budget_steps: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("control", &control);
            d.put_string("variant", &variant);
            d.put_int("budget_steps", budget_steps);
            ::flowlang::rustcmd::RustCmd::new("rzkmjv1a01927050dt1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn experiments() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jypzzo1a019271a79o1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn sft_run(name: String, dataset: String, base: String, rank: i64, steps: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("dataset", &dataset);
            d.put_string("base", &base);
            d.put_int("rank", rank);
            d.put_int("steps", steps);
            ::flowlang::rustcmd::RustCmd::new("uoioiv1a01938479ci1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn sft_promote(checkpoint: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("checkpoint", &checkpoint);
            ::flowlang::rustcmd::RustCmd::new("zzzosn1a019385f6fn1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_feed(name: String, kind: String, lines: String, lineage: String, provenance: String, holdout_every: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("kind", &kind);
            d.put_string("lines", &lines);
            d.put_string("lineage", &lineage);
            d.put_string("provenance", &provenance);
            d.put_int("holdout_every", holdout_every);
            ::flowlang::rustcmd::RustCmd::new("vvhumz1a019d18b18t1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn why_harvest(source: String, repo_path: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("source", &source);
            d.put_string("repo_path", &repo_path);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("gnvkzr1a01a0b0e05g1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn harvest_report(window_days: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("window_days", window_days);
            ::flowlang::rustcmd::RustCmd::new("hgkzok1a01a3db91ck1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod msg {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn put(role: String, venue: String, content: String, entity: String, provenance: String, id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("role", &role);
            d.put_string("venue", &venue);
            d.put_string("content", &content);
            d.put_string("entity", &entity);
            d.put_string("provenance", &provenance);
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("mhtnxo1a019c47805n1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get(id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("qhtrpu1a019c59f5ep1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn recent(venue: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("venue", &venue);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("qvoxjm1a019c5b988h1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod context {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn assemble(purpose: String, subject: String, budget: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("purpose", &purpose);
            d.put_string("subject", &subject);
            d.put_int("budget", budget);
            ::flowlang::rustcmd::RustCmd::new("qszxrr1a019d94db9r1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod tools {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn ssh_run(host: String, cmd: String, timeout_secs: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("host", &host);
            d.put_string("cmd", &cmd);
            d.put_int("timeout_secs", timeout_secs);
            ::flowlang::rustcmd::RustCmd::new("lqmggg1a038e57681y2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rsync_push(host: String, src: String, dst: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("host", &host);
            d.put_string("src", &src);
            d.put_string("dst", &dst);
            ::flowlang::rustcmd::RustCmd::new("mwqqpm1a038e5b92dn4").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod plan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn board() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hgqxqv1a03a50c89cw8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn move_item(claim: String, lifecycle: String, base: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("claim", &claim);
            d.put_string("lifecycle", &lifecycle);
            d.put_string("base", &base);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ijyjoz1a03a510268ta").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn add_item(claim: String, detail: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("claim", &claim);
            d.put_string("detail", &detail);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uyunpg1a03a5137c3yc").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod browser {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn eval(js: String, timeout_ms: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("js", &js);
            d.put_int("timeout_ms", timeout_ms);
            ::flowlang::rustcmd::RustCmd::new("xhuqpr1a03b7fe957i8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn open(url: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            ::flowlang::rustcmd::RustCmd::new("jqgspz1a03b805a1bja").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn goto(url: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            ::flowlang::rustcmd::RustCmd::new("tzwzqk1a03b80b9a5zc").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn text(selector: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("selector", &selector);
            ::flowlang::rustcmd::RustCmd::new("lxgqyp1a03b80e4c0te").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn click(selector: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("selector", &selector);
            ::flowlang::rustcmd::RustCmd::new("igmtmw1a03b810adfk10").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn fill(selector: String, value: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("selector", &selector);
            d.put_string("value", &value);
            ::flowlang::rustcmd::RustCmd::new("nhvyyr1a03b817969g14").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn wait_for(selector: String, timeout_ms: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("selector", &selector);
            d.put_int("timeout_ms", timeout_ms);
            ::flowlang::rustcmd::RustCmd::new("xkiujg1a03b821c3fu16").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn close() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ykmzmg1a03b82db11g1e").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn screenshot(url: String, path: String, width: i64, height: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            d.put_string("path", &path);
            d.put_int("width", width);
            d.put_int("height", height);
            ::flowlang::rustcmd::RustCmd::new("rvuzgy1a03fb16529n1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod browser_builder {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn builder_status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("gvozsx1a03ddbd726n20").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_config(key: String, value: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("key", &key);
            d.put_string("value", &value);
            ::flowlang::rustcmd::RustCmd::new("utnyms1a03ddc23f4y22").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn materialize_kit() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("wtuxuj1a03ddc855aq24").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn apply_patch() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("kzmmqr1a03ddce867n26").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn run_stage(stage: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("stage", &stage);
            ::flowlang::rustcmd::RustCmd::new("qquzjv1a03ddd9cc1y28").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stage_log(tail_lines: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("tail_lines", tail_lines);
            ::flowlang::rustcmd::RustCmd::new("wkttsj1a03dddee5ek2a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stop_build() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tggjti1a03dde0bb4i2c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install(mode: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("mode", &mode);
            ::flowlang::rustcmd::RustCmd::new("jnuoor1a03dde99c1l2e").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn repatch() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("uxxoxp1a073004790n1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod app {
    pub mod api {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod app {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn apps() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ynjjnl182f0c30c2ej26bb").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn asset(nn_path: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            ::flowlang::rustcmd::RustCmd::new("hxusrn182ebab0fc8o1102").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn assets(lib: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("uirppm183059f5a37z1b0c").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn delete(lib: String, id: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("mhnrjq18347bcd5f7t27").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn deletelib(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("hkgorn1834268eb07k1406").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn deviceid() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jypyqw1836795f8fbn2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn eventoff(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("xrysgt18350cb35cet3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn eventon(id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("app", &app);
            d.put_string("event", &event);
            d.put_string("cmdlib", &cmdlib);
            d.put_string("cmdid", &cmdid);
            ::flowlang::rustcmd::RustCmd::new("wlnoru18350ecc36cr4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn events(app: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("app", &app);
            ::flowlang::rustcmd::RustCmd::new("spumvi1834c2cf1e6t2").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn exec(lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_object("args", args);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("thoxjp182ee8eaebdt225").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn jsapi(nn_path: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            ::flowlang::rustcmd::RustCmd::new("zmzwjn182ee9c7f0ar314").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn libs() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtnluk1834262fb3fl137e").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn login(user: String, pass: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("user", &user);
            d.put_string("pass", &pass);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ztizvj182ee99186cp2d2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn newlib(lib: String, readers: DataArray, writers: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_array("readers", readers);
            d.put_array("writers", writers);
            ::flowlang::rustcmd::RustCmd::new("stskpj183421d8115xd3f").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn read(lib: String, id: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nyzimq182eabf7339p7c5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remembersession(nn_session: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("nn_session", nn_session);
            ::flowlang::rustcmd::RustCmd::new("tsmxsj182ee9ac271o2f3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn settings(settings: Data) -> DataObject {
            let mut d = DataObject::new();
            d.set_property("settings", settings);
            ::flowlang::rustcmd::RustCmd::new("knhvsn182f9997b1dxd04").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn spawn(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("args", args);
            ::flowlang::rustcmd::RustCmd::new("tvigvw19268109f0fg2a60").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn timeroff(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("hompli1835678a4efz2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn timeron(id: String, data: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("spjvvp183568021f1o2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn uninstall(app: String) -> String {
            let mut d = DataObject::new();
            d.put_string("app", &app);
            ::flowlang::rustcmd::RustCmd::new("gttrqg18303bc96c9w898").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn unique_session_id() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ynpmir183479da2b9r25f8").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn write(lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.set_property("id", id);
            d.put_object("data", data);
            d.set_property("readers", readers);
            d.set_property("writers", writers);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("yjjxqk18303e75f8atb5a").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod appcard {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod appinfo {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod dial {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod list {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod list_item {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod login {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenegraph {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod service {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn init() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mjkrmm183e1fdb2d2r8").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod shape {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod ui {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod ui_reference {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod util {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn hash(file: String) -> String {
            let mut d = DataObject::new();
            d.put_string("file", &file);
            ::flowlang::rustcmd::RustCmd::new("kgkxpw183664f5554q4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn init() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("thtpku18366290644p4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn zip(srcdir: String, destfile: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("srcdir", &srcdir);
            d.put_string("destfile", &destfile);
            ::flowlang::rustcmd::RustCmd::new("guuqrj1836147b650zd").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

    }
    pub mod sceneplayer {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneexpr {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenetokens {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenedoc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneproject {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenerun {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod forcelayout {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod tokens {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod webgl {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod home {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod dev {
    pub mod dev {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn check(lib: String, ctl: String, cmd: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("gsxkwg184e3fc96f9s2e1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn compile(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("gjssly1834862d5acg37d9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn compile_rust() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mhxogz1858786d9e1scf").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_lib(uuid: String, lib: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("kqgjmx1840a9081cdh172").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn lib_archive(lib: String, version: i64) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_int("version", version);
            ::flowlang::rustcmd::RustCmd::new("uykmrm183dbd15cdeu7b").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn lib_info(lib: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("knwozu1840a764abcu135").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rebuild_lib(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("yypums1847731c7fap5").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn activate_lib(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("lrgoyo19fe9049accu1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn crate_versions() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("wysojo1a052c43c59ha").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn update_crates(flowlang: String, ndata: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("flowlang", &flowlang);
            d.put_string("ndata", &ndata);
            ::flowlang::rustcmd::RustCmd::new("mzhpqp1a052c4c270sc").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn update_crates_status() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("nxnqxj1a052c503b6ke").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn restart_instance() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("zosxwm1a052c55690j10").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn hard_reset(url: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            ::flowlang::rustcmd::RustCmd::new("lwnwig1a052f17ecdt4").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod editcommand {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn compile_command(lib: String, control_name: String, cmd_name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_name", &control_name);
            d.put_string("cmd_name", &cmd_name);
            ::flowlang::rustcmd::RustCmd::new("wmjmsm19e30a16655r3439").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_command(lib: String, control_id: String, cmd_id: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("cmd_id", &cmd_id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("zjkntl19e309a2635o3426").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn save_command(lib: String, cmd_id: String, lang: String, code: String, imports: String, returntype: String, params: DataArray, desc: String, groups: String, readers: DataArray, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("cmd_id", &cmd_id);
            d.put_string("lang", &lang);
            d.put_string("code", &code);
            d.put_string("imports", &imports);
            d.put_string("returntype", &returntype);
            d.put_array("params", params);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            d.put_array("readers", readers);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("yqvnwh19e30916b04l3410").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn read_command(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("hkhmnw19e55777c46x41").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lookup_cmd_id(lib: String, ctl: String, cmd: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("vpqniv19e558047aeo59").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod editcontrol {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn add_component(lib: String, control_id: String, component_type: String, name: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("component_type", &component_type);
            d.put_string("name", &name);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ywmyvk19e2d0d215ai2c5b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn appdata(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("vsxqui18332a86185i159").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_control(lib: String, id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("ljxttx19e2c502d8bg2ab1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_publish_context(lib: String, control_id: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("lhknos19e2d258cb6w2c94").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lookup_id(lib: String, name: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("ggkslj19e2c58bb61q2ac8").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn publishapp(data: DataObject) -> DataArray {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("iwvgmq1835bb194ffo8").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn save_control(lib: String, id: String, html: String, css: String, js: String, groups: String, desc: String, readers: DataArray, inline_data: DataObject, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("html", &html);
            d.put_string("css", &css);
            d.put_string("js", &js);
            d.put_string("groups", &groups);
            d.put_string("desc", &desc);
            d.put_array("readers", readers);
            d.put_object("inline_data", inline_data);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uwoygr19e2c6bab55r2af6").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod github {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn import(url: String) -> String {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            ::flowlang::rustcmd::RustCmd::new("nnjgwh189dcdca95fq7c").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn list() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lovuhn189dc981ebch2f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn update(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("hioqsq19fe7789bcaj1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn remove(lib: String, delete_repository: bool) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_boolean("delete_repository", delete_repository);
            ::flowlang::rustcmd::RustCmd::new("lumrkn19fe778ea1bu3").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod libsettings {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn get_library_config(id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("gxysqz19721b331c9r54").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn save_library_config(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("wjhsqs19720f20d2ct8d").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod plugins {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_plugins() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("zvmhyt19763d3e070i43").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod workbench {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneeditor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod floweditor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod floweditor3d {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod editor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod preview {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod shelf {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod card {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod jump {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod frame {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod toast {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod session {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowdoc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowproject {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowprims {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowlayout {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod facets {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod code {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_commands(lib: String, ctl: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("ypmryt19ec1558019m1c2c").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_controls(lib: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("nhpgow19e9ddf15a2k6").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_libraries() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mtjtsw19e9dd5bcefg1de5").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn add_library(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("kqzknr19ec8a3ea32offa").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn add_control(lib: String, ctl: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("lmywwj19ec8a9e2ccm100b").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn upsert_command(lib: String, ctl: String, cmd: String, lang: String, return_type: String, params: DataArray, imports: String, code_body: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("lang", &lang);
            d.put_string("return_type", &return_type);
            d.put_array("params", params);
            d.put_string("imports", &imports);
            d.put_string("code_body", &code_body);
            ::flowlang::rustcmd::RustCmd::new("ovwolr19ec8c38800z1047").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn patch_command_body(lib: String, ctl: String, cmd: String, old_snippet: String, new_snippet: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("old_snippet", &old_snippet);
            d.put_string("new_snippet", &new_snippet);
            ::flowlang::rustcmd::RustCmd::new("slvzur19ed5ad5cc7k2c99").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_command(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("krpzxz19ed5b4aed9v2cad").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_command(lib: String, ctl: String, cmd: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("xqjpyg19ed5c0337dy2cca").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn search_commands(lib: String, ctl: String, query: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("query", &query);
            ::flowlang::rustcmd::RustCmd::new("shlglp19ed5d11bf9i2cf3").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn invoke_command(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("args", args);
            ::flowlang::rustcmd::RustCmd::new("hviwtu19ed5dc7dc5x2d10").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn evaluate_rust(imports: String, code: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("imports", &imports);
            d.put_string("code", &code);
            ::flowlang::rustcmd::RustCmd::new("nwnguj19ee5977c28s1527").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_control_facet(lib: String, ctl: String, facet: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("facet", &facet);
            ::flowlang::rustcmd::RustCmd::new("vwswvs19f95a61d29j3943").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn patch_control_facet(lib: String, ctl: String, facet: String, old_snippet: String, new_snippet: String, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("facet", &facet);
            d.put_string("old_snippet", &old_snippet);
            d.put_string("new_snippet", &new_snippet);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uyonls19f95a61d2cp3945").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn list_control_patches(lib: String, ctl: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("zkjqpy19f95a61d2eu3947").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_library_meta(lib: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("ouqqjw19f95a61d2fu3949").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_control_meta(lib: String, ctl: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("trogig19f95a61d30w394b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_command_meta(lib: String, ctl: String, cmd: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("hlsjpo19f95a61d32q394d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn list_assets(lib: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("iltsxi19f96bdd724l566d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_asset(lib: String, name: String, content: String, tempfile: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            d.put_string("content", &content);
            d.put_string("tempfile", &tempfile);
            ::flowlang::rustcmd::RustCmd::new("vxxmwl19f96bdd725r566f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rename_asset(lib: String, from: String, to: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("from", &from);
            d.put_string("to", &to);
            ::flowlang::rustcmd::RustCmd::new("qosxxk19f96bdd725z5671").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_asset(lib: String, name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("qvipjk19f96bdd726s5673").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_flow_body(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("nprqom19f9925517fn789d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_flow_body(lib: String, ctl: String, cmd: String, body: DataObject, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("body", body);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("vksvyz19f99255185j789f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_timer(lib: String, ctl: String, name: String, cmd: String, start: i64, startunit: String, interval: i64, intervalunit: String, repeat: bool, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("cmd", &cmd);
            d.put_int("start", start);
            d.put_string("startunit", &startunit);
            d.put_int("interval", interval);
            d.put_string("intervalunit", &intervalunit);
            d.put_boolean("repeat", repeat);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("kxtnil19f99e8b05bj9cfd").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_timer(lib: String, ctl: String, name: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ppjvhg19f99e8b05fv9cff").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_event_handler(lib: String, ctl: String, name: String, bot: String, event: String, cmd: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("bot", &bot);
            d.put_string("event", &event);
            d.put_string("cmd", &cmd);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("slwolg19f99e8b060l9d01").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_event_handler(lib: String, ctl: String, name: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("lyqmyx19f99e8b061q9d03").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_control_scene(lib: String, ctl: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("vtynpg19fa345cd8eyb2ff").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_control_scene(lib: String, ctl: String, scene: DataObject, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_object("scene", scene);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ltwuws19fa345cd8erb301").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_library(lib: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("juhgqn19faf571a9az1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_control(lib: String, ctl: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("tjhhxj19faf577471h1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn move_control(lib: String, ctl: String, to_lib: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("to_lib", &to_lib);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("pyjtgq19fb05aeb0cm1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_meta_identity(displayname: String, organization: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("displayname", &displayname);
            d.put_string("organization", &organization);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("pxilgw19fb08d4430k1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_meta_identity() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lgiozw19fb094fdfau1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn unpublish_app(lib: String, app: String, remove_runtime: bool, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("app", &app);
            d.put_boolean("remove_runtime", remove_runtime);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ijyuys19fb09ff451g1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_plugin(name: String, target_lib: String, target_ctl: String, plugin_lib: String, plugin_ctl: String, selector: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("target_lib", &target_lib);
            d.put_string("target_ctl", &target_ctl);
            d.put_string("plugin_lib", &plugin_lib);
            d.put_string("plugin_ctl", &plugin_ctl);
            d.put_string("selector", &selector);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("owxtlg19fb3b6cfd6v1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_plugin(name: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("znpnwu19fb3b71711u3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_tags(lib: String, ctl: String, cmd: String, tags: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("tags", &tags);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("vsxqpy19fb84a1ba4m1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_groups(lib: String, ctl: String, cmd: String, groups: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("groups", &groups);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ywwgiq19fb84a4e57h3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_command_imports(lib: String, ctl: String, cmd: String, imports: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("imports", &imports);
            ::flowlang::rustcmd::RustCmd::new("opoush19fbdfbfefbn1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ioyipx19feee23f1bq1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod viewctx {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod git {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn gitrun(repo: String, verb: String, args: DataArray, mode: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("verb", &verb);
            d.put_array("args", args);
            d.put_string("mode", &mode);
            ::flowlang::rustcmd::RustCmd::new("nqypsj1a02428c568n8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read(repo: String, verb: String, args: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("verb", &verb);
            d.put_array("args", args);
            ::flowlang::rustcmd::RustCmd::new("gnwoym1a02428f099ra").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write(repo: String, verb: String, args: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("verb", &verb);
            d.put_array("args", args);
            ::flowlang::rustcmd::RustCmd::new("qxjlkg1a024290af0wc").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remote_op(repo: String, verb: String, args: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("verb", &verb);
            d.put_array("args", args);
            ::flowlang::rustcmd::RustCmd::new("kjjhrz1a0242924e2ke").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_repo(name: String, path: String, origin: String, role: String, autocommit: bool, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("path", &path);
            d.put_string("origin", &origin);
            d.put_string("role", &role);
            d.put_boolean("autocommit", autocommit);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ztnxkn1a0242976cdh10").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_repo(name: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ohzpil1a02429afb3x12").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn repos() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qnmlxy1a02429d988k14").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn autocommit_sweep() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("xlqhrg1a02521633dv7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn merge_to_master(repo: String, branch: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("branch", &branch);
            ::flowlang::rustcmd::RustCmd::new("rwuprt1a05cfd1d26o118").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn abandon_branch(repo: String, branch: String, discard: bool, delete_remote: bool, next_branch: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("branch", &branch);
            d.put_boolean("discard", discard);
            d.put_boolean("delete_remote", delete_remote);
            d.put_string("next_branch", &next_branch);
            ::flowlang::rustcmd::RustCmd::new("hgoiwu1a05cfe25f6g11c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_autocommit(name: String, autocommit: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_boolean("autocommit", autocommit);
            ::flowlang::rustcmd::RustCmd::new("hzykqu1a05d00c1a3r124").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn store_status(repo: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            ::flowlang::rustcmd::RustCmd::new("olzqvh1a05d34239fp1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn commit_unit(repo: String, lib: String, ctl: String, message: String, author: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("message", &message);
            d.put_string("author", &author);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("rgkipv1a05d34ad79m3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn repo_state(repo: String, fetch: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_boolean("fetch", fetch);
            ::flowlang::rustcmd::RustCmd::new("uptjzh1a0733cce74r7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn start_branch(repo: String, branch: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("branch", &branch);
            ::flowlang::rustcmd::RustCmd::new("ymlwwx1a0733d3513t9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn update_from_master(repo: String, branch: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("branch", &branch);
            ::flowlang::rustcmd::RustCmd::new("wrwzmq1a0733d8548hb").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn carry_branch(repo: String, branch: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("branch", &branch);
            ::flowlang::rustcmd::RustCmd::new("ljkngp1a0740a1c47j1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn untrack_generated(repo: String, message: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("repo", &repo);
            d.put_string("message", &message);
            ::flowlang::rustcmd::RustCmd::new("slhoyo1a0740a96d8s3").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod fillmore {
    pub mod fillmore {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn authorize_store_download(pub_key: String, store_id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("pub_key", &pub_key);
            d.put_string("store_id", &store_id);
            ::flowlang::rustcmd::RustCmd::new("kuirmy19605c4c036j12f").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn authorize_store_upload(pub_key: String) -> String {
            let mut d = DataObject::new();
            d.put_string("pub_key", &pub_key);
            ::flowlang::rustcmd::RustCmd::new("rjkuxu19605afb230hf0").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn check_if_paused() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("uomxyj1946cb84b28l62").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn check_queue(tasks: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_array("tasks", tasks);
            ::flowlang::rustcmd::RustCmd::new("jrptzg194ed145660h40").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn do_synchronous(job: DataObject, parentlog: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            d.put_array("parentlog", parentlog);
            ::flowlang::rustcmd::RustCmd::new("wjogzs19534d621eeu17").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn gudrun_upload(jobid: String, file: String, fname: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("file", &file);
            d.put_string("fname", &fname);
            ::flowlang::rustcmd::RustCmd::new("gknspy18d9a4e9409s92").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn info() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hzgqwg1959c309237k5a5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lpptju18d95581943ue3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn launch_ec2(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("osvnjp18d955a9a3byec").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn launch_runpod(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("mgrjvr1962ac3bbdepe2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn oneshot_progress(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("snvmoi18d956b077at113").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn oneshot_upload(jobid: String, filename: String, uuid: String, streamid: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("filename", &filename);
            d.put_string("uuid", &uuid);
            d.put_int("streamid", streamid);
            ::flowlang::rustcmd::RustCmd::new("jxsmjg18d956ce475g11a").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn pause(pause: bool, allowone: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_boolean("pause", pause);
            d.put_boolean("allowone", allowone);
            ::flowlang::rustcmd::RustCmd::new("vupxsh1946c67ba79o5b4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn prepare_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("mnonjk1918ed34947i600").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn raw() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("woxywl196365f8af1n5f1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rip() -> i64 {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("holvlp19119c26565le").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn prune() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tyvpty19cee8b425aq208").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod queue {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn add_job(job: DataObject) -> bool {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("wlxlps194ebe4accaje8").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn get_next(tasks: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_array("tasks", tasks);
            ::flowlang::rustcmd::RustCmd::new("jpwmmy194ec4eede0h1d6").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_queue(name: String, _do_not_use_: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("_do_not_use_", &_do_not_use_);
            ::flowlang::rustcmd::RustCmd::new("vyonpg194ebccb895pb0").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn synchronous_job(job: DataObject, parentlog: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            d.put_array("parentlog", parentlog);
            ::flowlang::rustcmd::RustCmd::new("ownzur1953468c7b6w915").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod jobs {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn launch_worker(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("hzxlqh195a008419bk1c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn merge_loras(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("mxotri19773b680ddh2d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn video_to_lora(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("iwgkgz1958b602464w1c4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn oneshot(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("hpovqp19c92292802o2da").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod genmore {
    pub mod common {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn add_info_to_png(png: String, info: DataObject) -> bool {
            let mut d = DataObject::new();
            d.put_string("png", &png);
            d.put_object("info", info);
            ::flowlang::rustcmd::RustCmd::new("lnulwp195e86d5a90q59").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn build_archive(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("hiiqxs195de3ab57bu3b1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn default_bad_tags() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("njnlyo195dd7075f9j1e5").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn download_checkpoint(checkpoint: String) -> String {
            let mut d = DataObject::new();
            d.put_string("checkpoint", &checkpoint);
            ::flowlang::rustcmd::RustCmd::new("tkviqz195e2ccd7f3u2f6").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn download_lora(lora_id: String, store_id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lora_id", &lora_id);
            d.put_string("store_id", &store_id);
            ::flowlang::rustcmd::RustCmd::new("jlsuui195dd6e3574w1dd").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_realesrgan() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("oozvmq195dd9d0bd5r253").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn parse_tags(tags: DataObject, bad_tags: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("tags", tags);
            d.put_array("bad_tags", bad_tags);
            ::flowlang::rustcmd::RustCmd::new("uqiwlg1977adc5af8w2f2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn pg_bad_tags() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("wgjxlq195dd715c21w1ea").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn quantize(safetensors_path: String, gguf_path: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("safetensors_path", &safetensors_path);
            d.put_string("gguf_path", &gguf_path);
            ::flowlang::rustcmd::RustCmd::new("sysplj197abd7bcddtd7").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn read_lora_tags(lora: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lora", &lora);
            ::flowlang::rustcmd::RustCmd::new("gpqkol195dd73f84ar1f2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn sha256sum(path: String) -> String {
            let mut d = DataObject::new();
            d.put_string("path", &path);
            ::flowlang::rustcmd::RustCmd::new("ujkqht195e871daa8x69").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn tags_to_prompt(o: DataObject, trigger: String, gender: String, num_tags: i64, random: bool) -> String {
            let mut d = DataObject::new();
            d.put_object("o", o);
            d.put_string("trigger", &trigger);
            d.put_string("gender", &gender);
            d.put_int("num_tags", num_tags);
            d.put_boolean("random", random);
            ::flowlang::rustcmd::RustCmd::new("kulxum1977ad9c4f7x2e9").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn upscale(image: String, width: i64, height: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("image", &image);
            d.put_int("width", width);
            d.put_int("height", height);
            ::flowlang::rustcmd::RustCmd::new("okozkm195dec8d39dv126").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscale_dir(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("jnzupn195e863fb5ct41").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscaler_compact() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("nqwwgn195dee500b7i166").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscaler_esrgan() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jlhnyj195dee5dbebt16b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscaler_realesrgan() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("gnpvqs195dee6cd9cr170").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_lora_tags(lora_path: String, tags: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lora_path", &lora_path);
            d.put_object("tags", tags);
            ::flowlang::rustcmd::RustCmd::new("ouywjj19774a75f04o244").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_png_info(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lymkiy195e8702242l62").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_gpu_name() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jmlmik19d10c92bffx5c").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_spandrel() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tivuqo19e5b8fa5f8pa21").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscaler_spandrel(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("voziuk19e5baffa2axc0c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upscale_dir_spandrel(dir: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            ::flowlang::rustcmd::RustCmd::new("lwygwn19ee71bec69q585").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod ernie {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qnugzn19db260b817p326").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("rukzss19db2639df5p330").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod flux {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ygsjvv195e2812487s241").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_batch(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("livqzr197b6b9dc9dp36").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_clip(jobid: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("glmuxt197b70cfdd1j8d").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn generate_flash_attn() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vlyvrp197b74f413do17").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_latents(jobid: String, quantized: bool, width: i64, height: i64, cfg: f64, steps: i64, seed: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_boolean("quantized", quantized);
            d.put_int("width", width);
            d.put_int("height", height);
            d.put_float("cfg", cfg);
            d.put_int("steps", steps);
            d.put_int("seed", seed);
            ::flowlang::rustcmd::RustCmd::new("juivvy197b750cd13g1d").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn generate_quantized(job: DataObject) -> bool {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("yxqojp197abb3e1d7u86").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn generate_t5(jobid: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("zmghum197b6cf94b5g69").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn get_basemodel() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tqqjlj197b6e3cdc5k2e").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pwsmkz195e27758fbx228").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_klein() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pvkzpn19cecd3b81cx4b5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn merge(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("xwvpqz1977eafebbfz6c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn merge_to_basemodel(jobid: String, lora_ids: DataArray, lora_scales: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_array("lora_ids", lora_ids);
            d.put_array("lora_scales", lora_scales);
            ::flowlang::rustcmd::RustCmd::new("jnjzhu197b6089976i57").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn quantize_basemodel(jobid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("pwvury197b69aabf4t23").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn render_latents(jobid: String, width: i64, height: i64, cfg: f64, steps: i64, seed: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_int("width", width);
            d.put_int("height", height);
            d.put_float("cfg", cfg);
            d.put_int("steps", steps);
            d.put_int("seed", seed);
            ::flowlang::rustcmd::RustCmd::new("jjukjl197b8888847j31").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn generate_klein(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("otswkt19cece2768dg5af").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod genmore {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn combine_loras(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("joygtt19773c188b7p48").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_to_nsfw_src_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("rxoqtg19b7f6e5c4bx91").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_images(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("mnuilr195d92c2c1cj13e").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_prompts(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lmzjnt195dd670012i1c3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lora_to_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ropgmg1977994100an13").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_promptgen() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("umslgn19d348bd3d5t5bd").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn make_dataset_nsfw(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("nsoyyz19fc1f77b52y83d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_image_edit() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("shosru19fc2e3d9ffm44").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod hunyuan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mjkjlr195dd976eedh244").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("igullg195dda41a7fp266").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod ideogram4 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tlhijo19f05e2874dy1024").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("nxihwv19f089c88a7n1643").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod llm {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn generate_text(prompt: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("prompt", &prompt);
            ::flowlang::rustcmd::RustCmd::new("pykyim195dd6a8e73j1ce").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate_text_sync(prompt: String) -> String {
            let mut d = DataObject::new();
            d.put_string("prompt", &prompt);
            ::flowlang::rustcmd::RustCmd::new("gwmgln195dd6b9374i1d3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ozltqq195da1dfa4bib7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn load() -> bool {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("trprzy195da6f9a5bq16c").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn unload() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vnhiqy195da736d32h178").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod ltx2 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jxihkq19c42d8e231q64b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ztogpx19c43760b11v8a").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod qweni {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("txrnir1996447dfd7u98").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("snzztu199644d193eiaa").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod sdxl {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("twrkom195e2c888ffs2e5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("gjtgxy195e28e7ce2x262").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn merge(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("iunplh1977402fc0avda").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod wan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("giwspj1964973187fh95").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("myonlo1964974aaebp9b").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod wan22 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("joulym198f10cb858hcb1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("gjpurw198f10e2549gcc9").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod zimg {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("xxjsor19af5170586v2f8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn image_replace(src_dir: String, dest_dir: String, work_dir: String, subject: String, to_replace: String, replace_with: String, color_source: String, log: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("src_dir", &src_dir);
            d.put_string("dest_dir", &dest_dir);
            d.put_string("work_dir", &work_dir);
            d.put_string("subject", &subject);
            d.put_string("to_replace", &to_replace);
            d.put_string("replace_with", &replace_with);
            d.put_string("color_source", &color_source);
            d.put_array("log", log);
            ::flowlang::rustcmd::RustCmd::new("pxjmim19b7ed5f296sc8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("psqmui19af5149445z2f0").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_image_replace() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lntrho19b7e700c19j739").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn face_swap(src_dir: String, dest_dir: String, work_dir: String, target_person: String, lora_path: String, trigger_word: String, log: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("src_dir", &src_dir);
            d.put_string("dest_dir", &dest_dir);
            d.put_string("work_dir", &work_dir);
            d.put_string("target_person", &target_person);
            d.put_string("lora_path", &lora_path);
            d.put_string("trigger_word", &trigger_word);
            d.put_array("log", log);
            ::flowlang::rustcmd::RustCmd::new("zzpwiz19d0203bc2ai778").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod krea2 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tqztjs19f4c1a6b19he4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn generate(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("onhisw19f4c21d2d9rf8").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod grabmore {
    pub mod grabmore {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn crop_raw(workdir: String, threshold: f64, num_threads: i64, ref_img: Data) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("workdir", &workdir);
            d.put_float("threshold", threshold);
            d.put_int("num_threads", num_threads);
            d.set_property("ref_img", ref_img);
            ::flowlang::rustcmd::RustCmd::new("kwvvkg1919ea53d88p7ef").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_store(dir: String, upload_ids: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            d.put_array("upload_ids", upload_ids);
            ::flowlang::rustcmd::RustCmd::new("yvitxp194fb1c0bdaq124").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn download_video(url: String, dir: String, max_downloads: i64, upload_ids: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            d.put_string("dir", &dir);
            d.put_int("max_downloads", max_downloads);
            d.put_array("upload_ids", upload_ids);
            ::flowlang::rustcmd::RustCmd::new("jjwngv1916c2a405eu329").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn extract_raw(workdir: String, fps: f64, num_threads: i64, clean: bool, target_count: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("workdir", &workdir);
            d.put_float("fps", fps);
            d.put_int("num_threads", num_threads);
            d.put_boolean("clean", clean);
            d.put_int("target_count", target_count);
            ::flowlang::rustcmd::RustCmd::new("pmkpqj1916c3970acy351").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qxquzu1934fd1e5b3i6ec").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn instagram_to_dataset(channel: String, count: i64, crop: bool, tag: bool, trigger: String) -> String {
            let mut d = DataObject::new();
            d.put_string("channel", &channel);
            d.put_int("count", count);
            d.put_boolean("crop", crop);
            d.put_boolean("tag", tag);
            d.put_string("trigger", &trigger);
            ::flowlang::rustcmd::RustCmd::new("niwztk193b77c7e32r38").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn media_info(filename: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("filename", &filename);
            ::flowlang::rustcmd::RustCmd::new("gkpvjo1916c30a7c7w33a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn python_require(requirements: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_array("requirements", requirements);
            ::flowlang::rustcmd::RustCmd::new("xlvjwl193b2f2499bx9fb").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn url_to_dataset(url: String, trigger: String, crop: bool, tag: bool, upload_ids: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            d.put_string("trigger", &trigger);
            d.put_boolean("crop", crop);
            d.put_boolean("tag", tag);
            d.put_array("upload_ids", upload_ids);
            ::flowlang::rustcmd::RustCmd::new("jqmozw1916c23d998t318").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn oneshot_data(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("yzvsvm19c99cc298aj4c").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod imageproc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn crop_and_sort() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("xkygrg1919eadb21et806").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn prepare_dataset(workdir: String, num_steps: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("workdir", &workdir);
            d.put_int("num_steps", num_steps);
            ::flowlang::rustcmd::RustCmd::new("pkshih1921b8e6ea5u62").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod selenium {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mmxmln193b2ee8a7at9ef").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod tag {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install_tag() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("kothns19c246ba45fi51").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn tag(dir: String, trigger: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            d.put_string("trigger", &trigger);
            ::flowlang::rustcmd::RustCmd::new("pmuuwj1924389c1f6g4f88").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn load_dataset_tags(dir: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            ::flowlang::rustcmd::RustCmd::new("mymphw19c24be520ar71").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod tasks {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn build_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lmrioy1952fddfe3dye2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn build_src_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ijylrt1952f253939zce").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn clean(job: DataObject) -> bool {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("plkurx198ab2d56dbo1141").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn crop(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("yuhtgw1952fa90053p67").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("kxjzyk19500d55ccen96").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_instagram(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ryigwv1955827d2b5y2e3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_instagram_with_selenium(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("nroqmg19591a2b69ei46a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_store(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lwpgjy194fb20dda9k131").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_url(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("onlrgl194fcc2fff0o76").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn extract(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("xiinkx19500df5262z16").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn instagram_to_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("huvoiz19558529026i344").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn instagram_to_dataset_with_selenium(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("hrznhz19591b1114eo48c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn instagram_to_src_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ygxlwt1959a712925y1b9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn instagram_to_src_dataset_with_selenium(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("yyshtv19595216576oc62").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn media_to_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("vwnkjt1952f69afd9s171").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn media_to_src_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("gutrst1952fa7476dg61").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn src_dataset_to_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lnnulg195ab5f4f36h97").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn tag(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("xiujot1952fc1db3ewa1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod videoproc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn extract_all_frames(video_files: DataArray, frames_root: String, fps: f64) -> bool {
            let mut d = DataObject::new();
            d.put_array("video_files", video_files);
            d.put_string("frames_root", &frames_root);
            d.put_float("fps", fps);
            ::flowlang::rustcmd::RustCmd::new("lnvzjg19c00a3930aq33").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn extract_raw_frames(video_files: DataArray, frames_dir: String, output_dir: String, fps: f64, target_image_count: i64) -> String {
            let mut d = DataObject::new();
            d.put_array("video_files", video_files);
            d.put_string("frames_dir", &frames_dir);
            d.put_string("output_dir", &output_dir);
            d.put_float("fps", fps);
            d.put_int("target_image_count", target_image_count);
            ::flowlang::rustcmd::RustCmd::new("ntxpvr19c203276a4r4a").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn extract_segments(video_files: DataArray, ref_img_path: String, output_dir: String, frames_dir: String, fps: f64, max_total_duration: f64, max_clip: f64, is_strict: bool) -> DataArray {
            let mut d = DataObject::new();
            d.put_array("video_files", video_files);
            d.put_string("ref_img_path", &ref_img_path);
            d.put_string("output_dir", &output_dir);
            d.put_string("frames_dir", &frames_dir);
            d.put_float("fps", fps);
            d.put_float("max_total_duration", max_total_duration);
            d.put_float("max_clip", max_clip);
            d.put_boolean("is_strict", is_strict);
            ::flowlang::rustcmd::RustCmd::new("xnpmwh19be5b15c38r22f").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn generate_auto_reference(frames_dir: String, root: String, input_ref: Data) -> String {
            let mut d = DataObject::new();
            d.put_string("frames_dir", &frames_dir);
            d.put_string("root", &root);
            d.set_property("input_ref", input_ref);
            ::flowlang::rustcmd::RustCmd::new("tzrljv19c0080c958m62").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn prepare_source_video(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("purvvp19bffe75b63n19e1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod gudrun {
    pub mod active {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod admin {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_jobs(include_done: bool) -> DataArray {
            let mut d = DataObject::new();
            d.put_boolean("include_done", include_done);
            ::flowlang::rustcmd::RustCmd::new("ttprrx19290fbecean997").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn make_job_done(jobid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("hguwll1929704f401y2fe").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn read_last_3_days_job_data() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hmxujm1973121cc01p1cc").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn refund_job(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("pwmwwy19297bf3f59w19b").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn resubmit(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("tkkwol194dc3ad91cq673").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_job_error(jobid: String, errorcode: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("errorcode", &errorcode);
            ::flowlang::rustcmd::RustCmd::new("gisowm19297acb02bm16f").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn update_job(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ijgrkv198c7bfeb1fsa21").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod advanced {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod blank {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod blog {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod contact {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn dm(msg: DataObject, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_object("msg", msg);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("oxjvuw193dc1a28bbl56d").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod dataset {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn thumbnails(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("sxvmtw19dd52c5a04y5e").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod download_button {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod earlyaccess {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod example {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod faq {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod file_upload {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn is_upload_done(uid: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("uid", &uid);
            ::flowlang::rustcmd::RustCmd::new("lyuvlh1950bcd58b0sf7").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn start_upload(filename: String, filesize: i64, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("filename", &filename);
            d.put_int("filesize", filesize);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uwswok1934b73fd5bxbe").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn upload_chunk(upload_id: String, chunk_index: i64, chunk_data: String) -> String {
            let mut d = DataObject::new();
            d.put_string("upload_id", &upload_id);
            d.put_int("chunk_index", chunk_index);
            d.put_string("chunk_data", &chunk_data);
            ::flowlang::rustcmd::RustCmd::new("zzvzxl1934b7a4994wcf").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod footer {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod gudrun {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn attach(jobid: String, filename: String, uuid: String, streamid: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("filename", &filename);
            d.put_string("uuid", &uuid);
            d.put_int("streamid", streamid);
            ::flowlang::rustcmd::RustCmd::new("jhhjzv18d3c130709s79").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn balance(nn_sessionid: String) -> i64 {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("vqggnm18ce0962f77h41").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn calculate_price(job: DataObject) -> i64 {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("rwjslg1929792650ey132").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn dataset_thumbnails(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("xstyok19ddabea7c9u138").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn deletemyaccount(nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("usojnh196681eab3es1ba").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn download(storeid: String, jobid: String, extension: String) -> String {
            let mut d = DataObject::new();
            d.put_string("storeid", &storeid);
            d.put_string("jobid", &jobid);
            d.put_string("extension", &extension);
            ::flowlang::rustcmd::RustCmd::new("tnhvhp18f5dd70d61o17").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn finish(id: String, tk: String, data: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("tk", &tk);
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("nknijq18ccd24461dqc").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn hold(id: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("hrhgqy18cdff1d4f3j150").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("uurxvo18ccd09cff1o14d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn job(permalink: String, jobid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("permalink", &permalink);
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("ohvjth18cdb5eee1dr62").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn jobs(permalink: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("permalink", &permalink);
            ::flowlang::rustcmd::RustCmd::new("skxphp18cdb5ca51eg5a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn join(nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nzsywz18cdf79f2f6m44").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn loras(nn_sessionid: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("rgsvtv18cf62e36d7m54").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn permalink(nn_path: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("juovhm18cdf27b025z4e").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn progress(id: String, tk: String, data: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("tk", &tk);
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("myqswi18cd7a0dc5em55").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn rebuild_index() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tgvhhv195905f1806p196").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn register(uuid: String, pubkey: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("pubkey", &pubkey);
            ::flowlang::rustcmd::RustCmd::new("oiwrol18ccd038193h128").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn resubmit(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("kushyt194dc0b4720t603").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn status(nn_sessionid: String, permalink: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            d.put_string("permalink", &permalink);
            ::flowlang::rustcmd::RustCmd::new("nswhhx18d12bca315y536").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn submit(job: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("wwlmgg18ccd07a0e4m140").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn task(id: String, tk: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("tk", &tk);
            ::flowlang::rustcmd::RustCmd::new("qshnui18ccd050345u133").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn withdraw(amt: i64, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_int("amt", amt);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("kvxsox191d313ecf4s209").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn dataset_files(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("jxtjpn19ddabffd93k13e").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn dataset_update(payload: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("payload", payload);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("lzpspi1a0341ec531v1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn dataset_captions(jobid: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("whssht1a03e666a7bh1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod health {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod history {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod home {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod instagram_to_lora {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod job {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn accept_result_file(jobid: String, streamid: i64) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_int("streamid", streamid);
            ::flowlang::rustcmd::RustCmd::new("qtyytn18d37f397dbn190").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn delete_job(jobid: String, nn_sessionid: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uvmkgg197bb9a09c9u3d").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn info(jobid: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nwkiyn18cdc6ccb6eu48").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lookup_storeid(jobid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("wuipgt19087ece744p13").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn lookup_trigger(jobid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("hrkukv19088c10fbeqa5").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn update_job(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("inwuky198c7ad4174x9c2").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod jobs {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_jobs(nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("zyrton18cdc4f2297s23").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod landing {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod list_sessions {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_users() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pzwjkg19c53b7b6c2pd1").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn unload_users() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("svuwsw19c53b91c05re9").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn calculate_job_duration_stats(job_type: String, basemodel: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("job_type", &job_type);
            d.put_string("basemodel", &basemodel);
            ::flowlang::rustcmd::RustCmd::new("sunlzh19c6cc6fc62q286").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod log {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn log_http_begin(timestamp: i64, loc: String, method: String, host: String, path: String, querystring: String, referer: String) -> String {
            let mut d = DataObject::new();
            d.put_int("timestamp", timestamp);
            d.put_string("loc", &loc);
            d.put_string("method", &method);
            d.put_string("host", &host);
            d.put_string("path", &path);
            d.put_string("querystring", &querystring);
            d.put_string("referer", &referer);
            ::flowlang::rustcmd::RustCmd::new("hlukvq1989eafe26bn1a").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn query_http_logs(start_ts: i64, end_ts: i64, group_by: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("start_ts", start_ts);
            d.put_int("end_ts", end_ts);
            d.put_string("group_by", &group_by);
            ::flowlang::rustcmd::RustCmd::new("nunrqg1989ed1dff0z37").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod lora_to_image {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn load_lora_tags(storeid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("storeid", &storeid);
            ::flowlang::rustcmd::RustCmd::new("vrjxum1940e9f8563j269").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn submit(job: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("zrryxt1941580e310v1e").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod merge_loras {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod promo {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn get_promo_list() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ojrngo19755be6657z21").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn submit_promo(lora_id: String, url: String, displayname: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lora_id", &lora_id);
            d.put_string("url", &url);
            d.put_string("displayname", &displayname);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("vmlxyh197555226f2o285").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod promo_admin {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn approve_submission(submission_id: String, img_url: String) -> String {
            let mut d = DataObject::new();
            d.put_string("submission_id", &submission_id);
            d.put_string("img_url", &img_url);
            ::flowlang::rustcmd::RustCmd::new("twyxiq19756fe8456i82").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn decline_submission(submission_id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("submission_id", &submission_id);
            ::flowlang::rustcmd::RustCmd::new("vrvpmz19757004d48n89").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn download_promo_images() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pvjvtl19b18e77d34y8d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_submission_image_url(submission_id: String, img_url: String) -> String {
            let mut d = DataObject::new();
            d.put_string("submission_id", &submission_id);
            d.put_string("img_url", &img_url);
            ::flowlang::rustcmd::RustCmd::new("kltlng1983771e612s83").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod promo_countdown {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_basemodel {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_checkpoint {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_dataset {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_insta {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_urls {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod social {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn build_model_csv() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vghwzh19702c0d99du245").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn build_model_index() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vwmthq193564f17b9m5b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn fetch_all_images() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hzsjsz196fa7ba77eh72").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn fetch_model_data() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtuggy197039d4143t429").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("powoit197046ef24br17").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_featured() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("otiqos192e3563d01j622").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_model_images(version_id: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("version_id", &version_id);
            ::flowlang::rustcmd::RustCmd::new("ksnksn1935537aaeag8aa").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_models() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tglzss192de1f9f8ar7d2").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_models_with_stats() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtikii19356be59c0r45").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn set_featured(modelid: String, featured: bool) -> String {
            let mut d = DataObject::new();
            d.put_string("modelid", &modelid);
            d.put_boolean("featured", featured);
            ::flowlang::rustcmd::RustCmd::new("nmntmw192e358d918v62b").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod stats {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn jobs(start: i64, end: i64, exclude: DataArray) -> DataArray {
            let mut d = DataObject::new();
            d.put_int("start", start);
            d.put_int("end", end);
            d.put_array("exclude", exclude);
            ::flowlang::rustcmd::RustCmd::new("rqwlvs1915106f6ebr523").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn pageloads(start: i64, end: i64, step: i64) -> DataArray {
            let mut d = DataObject::new();
            d.put_int("start", start);
            d.put_int("end", end);
            d.put_int("step", step);
            ::flowlang::rustcmd::RustCmd::new("yskyrv18e5299d3d4m181").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn permalinks() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("onrkhn18dd197da4cl227").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn safetensors() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lzwnoq18de66d4f88v1bd").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn sales(start: i64, end: i64, step: i64) -> DataArray {
            let mut d = DataObject::new();
            d.put_int("start", start);
            d.put_int("end", end);
            d.put_int("step", step);
            ::flowlang::rustcmd::RustCmd::new("guuxtt19379355356o632").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn users(start: i64, end: i64) -> DataArray {
            let mut d = DataObject::new();
            d.put_int("start", start);
            d.put_int("end", end);
            ::flowlang::rustcmd::RustCmd::new("hoiuql19337556d0ax37a").execute(d).expect("Rust command execution failed").get_array("a")
        }

    }
    pub mod storytime {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod subject_selector {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod tag_editor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod tip {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn prepare_tip(jarid: String, tip: String) -> String {
            let mut d = DataObject::new();
            d.put_string("jarid", &jarid);
            d.put_string("tip", &tip);
            ::flowlang::rustcmd::RustCmd::new("jlvjsw199b5d003ebj117").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn tip(txcu: String, tipid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("txcu", &txcu);
            d.put_string("tipid", &tipid);
            ::flowlang::rustcmd::RustCmd::new("khtypp199b0bbc348j31a4").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod tokens {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn my_tipjar_id(nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nxtlyy199b4ca8653t7a3").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod topnav {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod train {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod video_to_lora {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select_fileupload {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod hagarmap {
    pub mod hagarmap {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn fetch_layers() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("xuwujq1a057976c2al23").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod kb {
    pub mod platform_api {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod workflow {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod frontend {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod m2026_07 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod doctrine {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod nebula {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod camera {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod plan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod minifig {
    pub mod minifig {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn check_for_job(uuid: String, tasks: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_array("tasks", tasks);
            ::flowlang::rustcmd::RustCmd::new("yonzix194ed099f12z26").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn composite_job(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ryrppr19533f642c7t811").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn download_from_store(store_id: String, file_path: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("store_id", &store_id);
            d.put_string("file_path", &file_path);
            ::flowlang::rustcmd::RustCmd::new("oujtox19605fdf4eco1b6").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn get_stats() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tkrvjo19a9cee338fr32").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("gksnol18d84cb94f4ke8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn job(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("pzpwxo18d864e7315x53").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn unlock() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("uzmitt18d84f6871ah14b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn upload_to_store(file_path: String) -> String {
            let mut d = DataObject::new();
            d.put_string("file_path", &file_path);
            ::flowlang::rustcmd::RustCmd::new("nrqgls19605e79a8bq182").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn set_polling(polling: bool) -> String {
            let mut d = DataObject::new();
            d.put_boolean("polling", polling);
            ::flowlang::rustcmd::RustCmd::new("yvpgzh19e756a8c45q14e1").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
}

pub mod nebula {
    pub mod lighthouse {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod nebula {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn add_member(servicename: String, peer: String, ipaddress: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_string("peer", &peer);
            d.put_string("ipaddress", &ipaddress);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("sisygw184fc3f0cffp14").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn build_config(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("ynjosj184fc757ea6g8c").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn create_network(name: String, subnet: String, port: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("subnet", &subnet);
            d.put_string("port", &port);
            ::flowlang::rustcmd::RustCmd::new("srmvjz184fc93489dscf").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn info() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vonhpn184fcbcae11r12c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("rvhgkr190c3084286y3de").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_release(url: String, version: String) -> String {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            d.put_string("version", &version);
            ::flowlang::rustcmd::RustCmd::new("ujwsot184fcf29e32j1a2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_service(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("lgnhmm184fe27c57dt3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn join_network(servicename: String, subnet: String, ipaddress: String, port: String, owner: String, ca_crt: String, host_crt: String, host_key: String, lighthouses: DataObject, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_string("subnet", &subnet);
            d.put_string("ipaddress", &ipaddress);
            d.put_string("port", &port);
            d.put_string("owner", &owner);
            d.put_string("ca_crt", &ca_crt);
            d.put_string("host_crt", &host_crt);
            d.put_string("host_key", &host_key);
            d.put_object("lighthouses", lighthouses);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("omjmup184fe38c98ej2a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn members(servicename: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("jymqyq184fe430846i41").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn restart_service(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("jvqmnp184fe4a3043p52").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn save_config(servicename: String, config: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_object("config", config);
            ::flowlang::rustcmd::RustCmd::new("qznznz184fca6baaclfb").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn start(servicename: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("hpsujs190c1e02ff6o143").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn start_service(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("mppkug184fe8f5a97rea").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn stop_service(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("jqlvpv184fe9036e4ked").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn uninstall_service(servicename: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("pvwytp1855e18b651y18").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn remove_member(servicename: String, peer: String) -> String {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_string("peer", &peer);
            ::flowlang::rustcmd::RustCmd::new("lnrqmk19ff0944578v1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn stop(servicename: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            ::flowlang::rustcmd::RustCmd::new("kzitxo1a03e29c32bk1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_boot(servicename: String, enabled: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_boolean("enabled", enabled);
            ::flowlang::rustcmd::RustCmd::new("riwrxj1a03e2afc73o1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn releases() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ugmpxx1a03e2b03e0p1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn endpoints(servicename: String, observe: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_string("observe", &observe);
            ::flowlang::rustcmd::RustCmd::new("gnnlzm1a03e2ba6c8y1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn update_hosts(servicename: String, hosts: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("servicename", &servicename);
            d.put_object("hosts", hosts);
            ::flowlang::rustcmd::RustCmd::new("rrpqpp1a03e2baf27y1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod network {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod member {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod peer {
    pub mod headsup {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod peer {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn discovery() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mlrhvx183e6eabd19xb4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn info(nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            d.set_property("uuid", uuid);
            d.set_property("salt", salt);
            ::flowlang::rustcmd::RustCmd::new("tkwkml18390d46728m8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn local(request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("request", request);
            d.put_object("nn_session", nn_session);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nylhvq183f6b61e43oc2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn peers() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ywokvt1838c110d92l8").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn remote(nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            d.put_object("nn_params", nn_params);
            d.put_object("nn_headers", nn_headers);
            ::flowlang::rustcmd::RustCmd::new("txnvil183f6ffdf58w1d").execute(d).expect("Rust command execution failed").get_bytes("a")
        }

    }
    pub mod peer_model {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod reboot {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hygrki1842eac55a9w2a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn reboot() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jmhvzv1843439faa0i305").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod service {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn close_stream(uuid: String, streamid: i64, write: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("streamid", streamid);
            d.put_boolean("write", write);
            ::flowlang::rustcmd::RustCmd::new("zqxtsm18d3d4ef2b3j101").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn discovery() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtxmqr183e5ff3ef5u82").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn exec(uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("app", &app);
            d.put_string("cmd", &cmd);
            d.put_object("params", params);
            ::flowlang::rustcmd::RustCmd::new("nmojwg18386b2f0d2n2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_stream(uuid: String, stream_id: i64) -> DataBytes {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("stream_id", stream_id);
            ::flowlang::rustcmd::RustCmd::new("hlmugl188ab38379arb5").execute(d).expect("Rust command execution failed").get_bytes("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("grvupm18379e9a159n8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn listen(ipaddr: String, port: i64) -> i64 {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("irxuhn18379cef5bcp4").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn listen_udp(ipaddr: String, port: i64) -> i64 {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("rgxowg183ad6b7a12u6").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn maintenance() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("rjntml18385b15b5ch0").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn new_stream(uuid: String) -> i64 {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            ::flowlang::rustcmd::RustCmd::new("myuvuz18d36f76d2cg3").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn session_expire(user: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("user", user);
            ::flowlang::rustcmd::RustCmd::new("lvvzvn183bd066566j4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stream_write(uuid: String, stream_id: i64, data: DataBytes) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("stream_id", stream_id);
            d.put_bytes("data", data);
            ::flowlang::rustcmd::RustCmd::new("pmumpq18d39a2594cp3").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn tcp_connect(uuid: String, ipaddr: String, port: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("ltnpiq18385ba6cc7u3").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn udp_connect(ipaddr: String, port: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("gloivk183adf03115od").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod peer_select {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod runtime {
}

pub mod security {
    pub mod security {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn current_user(nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ihxsxh18410251dfapf7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn deleteuser(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("jszjgy1836bfe023ckc").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn groups() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qjmvtm1836b1bc850o9").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("suvlkp1846cfa2235q2c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn setuser(id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("displayname", &displayname);
            d.put_string("password", &password);
            d.put_array("groups", groups);
            d.set_property("keepalive", keepalive);
            d.set_property("address", address);
            d.set_property("port", port);
            ::flowlang::rustcmd::RustCmd::new("soqxoo1836bb51d5dy2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn users() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ysnihn1836b0814aen5").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod storage {
    pub mod storage {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn authorize_download(pub_key: String, store_id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("pub_key", &pub_key);
            d.put_string("store_id", &store_id);
            ::flowlang::rustcmd::RustCmd::new("tptwvn195fcccd48ez320").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn authorize_upload(pub_key: String) -> String {
            let mut d = DataObject::new();
            d.put_string("pub_key", &pub_key);
            ::flowlang::rustcmd::RustCmd::new("jskoxr195fc4b83b4k202").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn fetch(storeid: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("storeid", &storeid);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("lkphmi18ec55a27c3y4f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get(uuid: String, storeid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("storeid", &storeid);
            ::flowlang::rustcmd::RustCmd::new("ztitoz18ec5ba6e67l128").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("sngjmi195f8ca2468r611").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn nfs_mount(remote: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("remote", &remote);
            ::flowlang::rustcmd::RustCmd::new("rppxxn1911dc551bbt678").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn nfs_save() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("myzqwi1911dca5c68m686").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn put(uuid: String, path: String) -> String {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("path", &path);
            ::flowlang::rustcmd::RustCmd::new("zppnun18ec59bd0acke2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn store(len: i64, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_int("len", len);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("hgthyv18ec52c5298h297").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub mod trainmore {
    pub mod common {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn default_bad_tags() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("xtojkw195d8a0dd79z29d").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn download_checkpoint(checkpoint: String) -> String {
            let mut d = DataObject::new();
            d.put_string("checkpoint", &checkpoint);
            ::flowlang::rustcmd::RustCmd::new("mwjpgg195d8d8b661w82").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_realesrgan() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("tmuxqz195d2bfcdf8rfe").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_smiling_wolf() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pjwltt195d2bed70eqf9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn load_dataset_tags(dir: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            ::flowlang::rustcmd::RustCmd::new("uomzun195d3068f32x1a0").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn parse_tags(tags: DataObject, bad_tags: DataArray) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("tags", tags);
            d.put_array("bad_tags", bad_tags);
            ::flowlang::rustcmd::RustCmd::new("ymhvwp195d894a31bw27a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn pg_bad_tags() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lzwysi195d899877eg287").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn pull_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("oosgmy195d2b439f9hdb").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn tags_to_prompt(o: DataObject, trigger: String, gender: String, num_tags: i64, random: bool) -> String {
            let mut d = DataObject::new();
            d.put_object("o", o);
            d.put_string("trigger", &trigger);
            d.put_string("gender", &gender);
            d.put_int("num_tags", num_tags);
            d.put_boolean("random", random);
            ::flowlang::rustcmd::RustCmd::new("tmukxz195d89cb3aaj291").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn write_lora_tags(lora_path: String, tags: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lora_path", &lora_path);
            d.put_object("tags", tags);
            ::flowlang::rustcmd::RustCmd::new("jhllsn195d3080ae7h1a6").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_gpu_name() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("iruzjh19d106046fco1287").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn capture_captions(jobid: String, captions: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("jobid", &jobid);
            d.put_object("captions", captions);
            ::flowlang::rustcmd::RustCmd::new("kzpqmw1a035f641a9u1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn restore_captions(storeid: String, jobid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("storeid", &storeid);
            d.put_string("jobid", &jobid);
            ::flowlang::rustcmd::RustCmd::new("mhppnt1a035f687d3p3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn ensure_trigger(dir: String, trigger: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            d.put_string("trigger", &trigger);
            ::flowlang::rustcmd::RustCmd::new("prrjlt1a0364b5673v1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn load_user_captions(dir: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            ::flowlang::rustcmd::RustCmd::new("totsmo1a03e84382bs1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod ernie {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("syhsuv19daf9d1032y62f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ykxptg19daf9f5ffeq637").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod flux {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mkvtvi195d876081el231").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ygknil195d882e57dz250").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod flux2 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("oozopi19acb6eab1dk30e9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install_klein() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("nxkliu19ce95c43e9x26a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("hplmny19ad08654c6r3c30").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train_klein(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("rzyhls19ce9aa8cfat32").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod hunyuan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("srzklw195d2bc9dc8uf1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("jlqxhy195d2c4eee3p10d").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod ideogram4 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("urkkvn19f056f3fd4wf1d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("opjugz19f057286acwf28").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn add_trigger_to_captions(dir: String, trigger: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("dir", &dir);
            d.put_string("trigger", &trigger);
            ::flowlang::rustcmd::RustCmd::new("gytzkj19f14a28084j60").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

    }
    pub mod ltx2 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn caption_videos(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("wluwlt19c11fcdf4as72").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("pvtpgn19c0599c05fg174").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn process_dataset(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("lmnyzz19c159bea59s87").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("tjllqw19c15b128b2nb8").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod qweni {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("rlspsi1996328c3abm227").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("kuoris199633b56d6g253").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod sdxl {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hhvrpk195d8ccd7eco61").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("httuto195d8d49d13h75").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod trainmore {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn dataset_to_lora(job: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("rrhzxh195d2aefa0fobf").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod wan {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vuigvv1964404049aw156").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("xpniiq19648ed99a9qc8").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod wan22 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hlvtqh198f0b16bffoa64").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("knjqvm198f0c076a8ia87").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod zimg {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hqwiyi19af00bc9ecyab2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("ptimix19af0299c34naf6").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod krea2 {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn install() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("wxrkqx19f38c73d93q1ef").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn train(job: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("job", job);
            ::flowlang::rustcmd::RustCmd::new("pgnpnk19f47d33bf7n382").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
}

pub struct old_agent_agent {}
pub struct old_agent_llm {}
pub struct old_agent_plugin {}
pub struct old_agent_scratch {}
pub struct old_agent_agentloop {}
pub struct old_agent_agentprompt {}
pub struct old_agent_memory {}
pub struct old_agent_archivist {}
pub struct old_agent_chat {}
pub struct old_agent_askrow {}
pub struct old_agent_describebtn {}
pub struct old_agent_prompts {}
pub struct old_agent_executive {}
pub struct old_agent_sensor {}
pub struct old_agent_model {}
pub struct old_agent_msg {}
pub struct old_agent_context {}
pub struct old_agent_tools {}
pub struct old_agent_plan {}
pub struct old_agent_browser {}
pub struct old_agent_browser_builder {}
pub struct old_app_api {}
pub struct old_app_app {}
pub struct old_app_appcard {}
pub struct old_app_appinfo {}
pub struct old_app_dial {}
pub struct old_app_list {}
pub struct old_app_list_item {}
pub struct old_app_login {}
pub struct old_app_scenegraph {}
pub struct old_app_select {}
pub struct old_app_service {}
pub struct old_app_shape {}
pub struct old_app_ui {}
pub struct old_app_ui_reference {}
pub struct old_app_util {}
pub struct old_app_sceneplayer {}
pub struct old_app_sceneexpr {}
pub struct old_app_scenetokens {}
pub struct old_app_scenedoc {}
pub struct old_app_sceneproject {}
pub struct old_app_scenerun {}
pub struct old_app_forcelayout {}
pub struct old_app_tokens {}
pub struct old_app_webgl {}
pub struct old_app_home {}
pub struct old_dev_dev {}
pub struct old_dev_editcommand {}
pub struct old_dev_editcontrol {}
pub struct old_dev_github {}
pub struct old_dev_libsettings {}
pub struct old_dev_plugins {}
pub struct old_dev_workbench {}
pub struct old_dev_sceneeditor {}
pub struct old_dev_floweditor {}
pub struct old_dev_floweditor3d {}
pub struct old_dev_editor {}
pub struct old_dev_preview {}
pub struct old_dev_shelf {}
pub struct old_dev_card {}
pub struct old_dev_jump {}
pub struct old_dev_frame {}
pub struct old_dev_toast {}
pub struct old_dev_session {}
pub struct old_dev_flowdoc {}
pub struct old_dev_flowproject {}
pub struct old_dev_flowprims {}
pub struct old_dev_flowlayout {}
pub struct old_dev_facets {}
pub struct old_dev_code {}
pub struct old_dev_viewctx {}
pub struct old_dev_git {}
pub struct old_fillmore_fillmore {}
pub struct old_fillmore_queue {}
pub struct old_fillmore_jobs {}
pub struct old_genmore_common {}
pub struct old_genmore_ernie {}
pub struct old_genmore_flux {}
pub struct old_genmore_genmore {}
pub struct old_genmore_hunyuan {}
pub struct old_genmore_ideogram4 {}
pub struct old_genmore_llm {}
pub struct old_genmore_ltx2 {}
pub struct old_genmore_qweni {}
pub struct old_genmore_sdxl {}
pub struct old_genmore_wan {}
pub struct old_genmore_wan22 {}
pub struct old_genmore_zimg {}
pub struct old_genmore_krea2 {}
pub struct old_grabmore_grabmore {}
pub struct old_grabmore_imageproc {}
pub struct old_grabmore_selenium {}
pub struct old_grabmore_tag {}
pub struct old_grabmore_tasks {}
pub struct old_grabmore_videoproc {}
pub struct old_gudrun_active {}
pub struct old_gudrun_admin {}
pub struct old_gudrun_advanced {}
pub struct old_gudrun_blank {}
pub struct old_gudrun_blog {}
pub struct old_gudrun_contact {}
pub struct old_gudrun_dataset {}
pub struct old_gudrun_download_button {}
pub struct old_gudrun_earlyaccess {}
pub struct old_gudrun_example {}
pub struct old_gudrun_faq {}
pub struct old_gudrun_file_upload {}
pub struct old_gudrun_footer {}
pub struct old_gudrun_gudrun {}
pub struct old_gudrun_health {}
pub struct old_gudrun_history {}
pub struct old_gudrun_home {}
pub struct old_gudrun_instagram_to_lora {}
pub struct old_gudrun_job {}
pub struct old_gudrun_jobs {}
pub struct old_gudrun_landing {}
pub struct old_gudrun_list_sessions {}
pub struct old_gudrun_log {}
pub struct old_gudrun_lora_to_image {}
pub struct old_gudrun_merge_loras {}
pub struct old_gudrun_promo {}
pub struct old_gudrun_promo_admin {}
pub struct old_gudrun_promo_countdown {}
pub struct old_gudrun_select_basemodel {}
pub struct old_gudrun_select_checkpoint {}
pub struct old_gudrun_select_dataset {}
pub struct old_gudrun_select_insta {}
pub struct old_gudrun_select_urls {}
pub struct old_gudrun_social {}
pub struct old_gudrun_stats {}
pub struct old_gudrun_storytime {}
pub struct old_gudrun_subject_selector {}
pub struct old_gudrun_tag_editor {}
pub struct old_gudrun_tip {}
pub struct old_gudrun_tokens {}
pub struct old_gudrun_topnav {}
pub struct old_gudrun_train {}
pub struct old_gudrun_video_to_lora {}
pub struct old_gudrun_select_fileupload {}
pub struct old_hagarmap_hagarmap {}
pub struct old_kb_platform_api {}
pub struct old_kb_workflow {}
pub struct old_kb_frontend {}
pub struct old_kb_m2026_07 {}
pub struct old_kb_doctrine {}
pub struct old_kb_nebula {}
pub struct old_kb_camera {}
pub struct old_kb_plan {}
pub struct old_minifig_minifig {}
pub struct old_nebula_lighthouse {}
pub struct old_nebula_nebula {}
pub struct old_nebula_network {}
pub struct old_nebula_member {}
pub struct old_peer_headsup {}
pub struct old_peer_peer {}
pub struct old_peer_peer_model {}
pub struct old_peer_reboot {}
pub struct old_peer_service {}
pub struct old_peer_peer_select {}
pub struct old_security_security {}
pub struct old_storage_storage {}
pub struct old_trainmore_common {}
pub struct old_trainmore_ernie {}
pub struct old_trainmore_flux {}
pub struct old_trainmore_flux2 {}
pub struct old_trainmore_hunyuan {}
pub struct old_trainmore_ideogram4 {}
pub struct old_trainmore_ltx2 {}
pub struct old_trainmore_qweni {}
pub struct old_trainmore_sdxl {}
pub struct old_trainmore_trainmore {}
pub struct old_trainmore_wan {}
pub struct old_trainmore_wan22 {}
pub struct old_trainmore_zimg {}
pub struct old_trainmore_krea2 {}
pub struct old_agent {
    pub agent: old_agent_agent,
    pub llm: old_agent_llm,
    pub plugin: old_agent_plugin,
    pub scratch: old_agent_scratch,
    pub agentloop: old_agent_agentloop,
    pub agentprompt: old_agent_agentprompt,
    pub memory: old_agent_memory,
    pub archivist: old_agent_archivist,
    pub chat: old_agent_chat,
    pub askrow: old_agent_askrow,
    pub describebtn: old_agent_describebtn,
    pub prompts: old_agent_prompts,
    pub executive: old_agent_executive,
    pub sensor: old_agent_sensor,
    pub model: old_agent_model,
    pub msg: old_agent_msg,
    pub context: old_agent_context,
    pub tools: old_agent_tools,
    pub plan: old_agent_plan,
    pub browser: old_agent_browser,
    pub browser_builder: old_agent_browser_builder,
}
pub struct old_app {
    pub api: old_app_api,
    pub app: old_app_app,
    pub appcard: old_app_appcard,
    pub appinfo: old_app_appinfo,
    pub dial: old_app_dial,
    pub list: old_app_list,
    pub list_item: old_app_list_item,
    pub login: old_app_login,
    pub scenegraph: old_app_scenegraph,
    pub select: old_app_select,
    pub service: old_app_service,
    pub shape: old_app_shape,
    pub ui: old_app_ui,
    pub ui_reference: old_app_ui_reference,
    pub util: old_app_util,
    pub sceneplayer: old_app_sceneplayer,
    pub sceneexpr: old_app_sceneexpr,
    pub scenetokens: old_app_scenetokens,
    pub scenedoc: old_app_scenedoc,
    pub sceneproject: old_app_sceneproject,
    pub scenerun: old_app_scenerun,
    pub forcelayout: old_app_forcelayout,
    pub tokens: old_app_tokens,
    pub webgl: old_app_webgl,
    pub home: old_app_home,
}
pub struct old_dev {
    pub dev: old_dev_dev,
    pub editcommand: old_dev_editcommand,
    pub editcontrol: old_dev_editcontrol,
    pub github: old_dev_github,
    pub libsettings: old_dev_libsettings,
    pub plugins: old_dev_plugins,
    pub workbench: old_dev_workbench,
    pub sceneeditor: old_dev_sceneeditor,
    pub floweditor: old_dev_floweditor,
    pub floweditor3d: old_dev_floweditor3d,
    pub editor: old_dev_editor,
    pub preview: old_dev_preview,
    pub shelf: old_dev_shelf,
    pub card: old_dev_card,
    pub jump: old_dev_jump,
    pub frame: old_dev_frame,
    pub toast: old_dev_toast,
    pub session: old_dev_session,
    pub flowdoc: old_dev_flowdoc,
    pub flowproject: old_dev_flowproject,
    pub flowprims: old_dev_flowprims,
    pub flowlayout: old_dev_flowlayout,
    pub facets: old_dev_facets,
    pub code: old_dev_code,
    pub viewctx: old_dev_viewctx,
    pub git: old_dev_git,
}
pub struct old_fillmore {
    pub fillmore: old_fillmore_fillmore,
    pub queue: old_fillmore_queue,
    pub jobs: old_fillmore_jobs,
}
pub struct old_genmore {
    pub common: old_genmore_common,
    pub ernie: old_genmore_ernie,
    pub flux: old_genmore_flux,
    pub genmore: old_genmore_genmore,
    pub hunyuan: old_genmore_hunyuan,
    pub ideogram4: old_genmore_ideogram4,
    pub llm: old_genmore_llm,
    pub ltx2: old_genmore_ltx2,
    pub qweni: old_genmore_qweni,
    pub sdxl: old_genmore_sdxl,
    pub wan: old_genmore_wan,
    pub wan22: old_genmore_wan22,
    pub zimg: old_genmore_zimg,
    pub krea2: old_genmore_krea2,
}
pub struct old_grabmore {
    pub grabmore: old_grabmore_grabmore,
    pub imageproc: old_grabmore_imageproc,
    pub selenium: old_grabmore_selenium,
    pub tag: old_grabmore_tag,
    pub tasks: old_grabmore_tasks,
    pub videoproc: old_grabmore_videoproc,
}
pub struct old_gudrun {
    pub active: old_gudrun_active,
    pub admin: old_gudrun_admin,
    pub advanced: old_gudrun_advanced,
    pub blank: old_gudrun_blank,
    pub blog: old_gudrun_blog,
    pub contact: old_gudrun_contact,
    pub dataset: old_gudrun_dataset,
    pub download_button: old_gudrun_download_button,
    pub earlyaccess: old_gudrun_earlyaccess,
    pub example: old_gudrun_example,
    pub faq: old_gudrun_faq,
    pub file_upload: old_gudrun_file_upload,
    pub footer: old_gudrun_footer,
    pub gudrun: old_gudrun_gudrun,
    pub health: old_gudrun_health,
    pub history: old_gudrun_history,
    pub home: old_gudrun_home,
    pub instagram_to_lora: old_gudrun_instagram_to_lora,
    pub job: old_gudrun_job,
    pub jobs: old_gudrun_jobs,
    pub landing: old_gudrun_landing,
    pub list_sessions: old_gudrun_list_sessions,
    pub log: old_gudrun_log,
    pub lora_to_image: old_gudrun_lora_to_image,
    pub merge_loras: old_gudrun_merge_loras,
    pub promo: old_gudrun_promo,
    pub promo_admin: old_gudrun_promo_admin,
    pub promo_countdown: old_gudrun_promo_countdown,
    pub select_basemodel: old_gudrun_select_basemodel,
    pub select_checkpoint: old_gudrun_select_checkpoint,
    pub select_dataset: old_gudrun_select_dataset,
    pub select_insta: old_gudrun_select_insta,
    pub select_urls: old_gudrun_select_urls,
    pub social: old_gudrun_social,
    pub stats: old_gudrun_stats,
    pub storytime: old_gudrun_storytime,
    pub subject_selector: old_gudrun_subject_selector,
    pub tag_editor: old_gudrun_tag_editor,
    pub tip: old_gudrun_tip,
    pub tokens: old_gudrun_tokens,
    pub topnav: old_gudrun_topnav,
    pub train: old_gudrun_train,
    pub video_to_lora: old_gudrun_video_to_lora,
    pub select_fileupload: old_gudrun_select_fileupload,
}
pub struct old_hagarmap {
    pub hagarmap: old_hagarmap_hagarmap,
}
pub struct old_kb {
    pub platform_api: old_kb_platform_api,
    pub workflow: old_kb_workflow,
    pub frontend: old_kb_frontend,
    pub m2026_07: old_kb_m2026_07,
    pub doctrine: old_kb_doctrine,
    pub nebula: old_kb_nebula,
    pub camera: old_kb_camera,
    pub plan: old_kb_plan,
}
pub struct old_minifig {
    pub minifig: old_minifig_minifig,
}
pub struct old_nebula {
    pub lighthouse: old_nebula_lighthouse,
    pub nebula: old_nebula_nebula,
    pub network: old_nebula_network,
    pub member: old_nebula_member,
}
pub struct old_peer {
    pub headsup: old_peer_headsup,
    pub peer: old_peer_peer,
    pub peer_model: old_peer_peer_model,
    pub reboot: old_peer_reboot,
    pub service: old_peer_service,
    pub peer_select: old_peer_peer_select,
}
pub struct old_runtime {
}
pub struct old_security {
    pub security: old_security_security,
}
pub struct old_storage {
    pub storage: old_storage_storage,
}
pub struct old_trainmore {
    pub common: old_trainmore_common,
    pub ernie: old_trainmore_ernie,
    pub flux: old_trainmore_flux,
    pub flux2: old_trainmore_flux2,
    pub hunyuan: old_trainmore_hunyuan,
    pub ideogram4: old_trainmore_ideogram4,
    pub ltx2: old_trainmore_ltx2,
    pub qweni: old_trainmore_qweni,
    pub sdxl: old_trainmore_sdxl,
    pub trainmore: old_trainmore_trainmore,
    pub wan: old_trainmore_wan,
    pub wan22: old_trainmore_wan22,
    pub zimg: old_trainmore_zimg,
    pub krea2: old_trainmore_krea2,
}
pub struct api {
    pub agent: old_agent,
    pub app: old_app,
    pub dev: old_dev,
    pub fillmore: old_fillmore,
    pub genmore: old_genmore,
    pub grabmore: old_grabmore,
    pub gudrun: old_gudrun,
    pub hagarmap: old_hagarmap,
    pub kb: old_kb,
    pub minifig: old_minifig,
    pub nebula: old_nebula,
    pub peer: old_peer,
    pub runtime: old_runtime,
    pub security: old_security,
    pub storage: old_storage,
    pub trainmore: old_trainmore,
}

pub const fn new() -> api {
    api {
        agent: old_agent {
            agent: old_agent_agent {},
            llm: old_agent_llm {},
            plugin: old_agent_plugin {},
            scratch: old_agent_scratch {},
            agentloop: old_agent_agentloop {},
            agentprompt: old_agent_agentprompt {},
            memory: old_agent_memory {},
            archivist: old_agent_archivist {},
            chat: old_agent_chat {},
            askrow: old_agent_askrow {},
            describebtn: old_agent_describebtn {},
            prompts: old_agent_prompts {},
            executive: old_agent_executive {},
            sensor: old_agent_sensor {},
            model: old_agent_model {},
            msg: old_agent_msg {},
            context: old_agent_context {},
            tools: old_agent_tools {},
            plan: old_agent_plan {},
            browser: old_agent_browser {},
            browser_builder: old_agent_browser_builder {},
        },
        app: old_app {
            api: old_app_api {},
            app: old_app_app {},
            appcard: old_app_appcard {},
            appinfo: old_app_appinfo {},
            dial: old_app_dial {},
            list: old_app_list {},
            list_item: old_app_list_item {},
            login: old_app_login {},
            scenegraph: old_app_scenegraph {},
            select: old_app_select {},
            service: old_app_service {},
            shape: old_app_shape {},
            ui: old_app_ui {},
            ui_reference: old_app_ui_reference {},
            util: old_app_util {},
            sceneplayer: old_app_sceneplayer {},
            sceneexpr: old_app_sceneexpr {},
            scenetokens: old_app_scenetokens {},
            scenedoc: old_app_scenedoc {},
            sceneproject: old_app_sceneproject {},
            scenerun: old_app_scenerun {},
            forcelayout: old_app_forcelayout {},
            tokens: old_app_tokens {},
            webgl: old_app_webgl {},
            home: old_app_home {},
        },
        dev: old_dev {
            dev: old_dev_dev {},
            editcommand: old_dev_editcommand {},
            editcontrol: old_dev_editcontrol {},
            github: old_dev_github {},
            libsettings: old_dev_libsettings {},
            plugins: old_dev_plugins {},
            workbench: old_dev_workbench {},
            sceneeditor: old_dev_sceneeditor {},
            floweditor: old_dev_floweditor {},
            floweditor3d: old_dev_floweditor3d {},
            editor: old_dev_editor {},
            preview: old_dev_preview {},
            shelf: old_dev_shelf {},
            card: old_dev_card {},
            jump: old_dev_jump {},
            frame: old_dev_frame {},
            toast: old_dev_toast {},
            session: old_dev_session {},
            flowdoc: old_dev_flowdoc {},
            flowproject: old_dev_flowproject {},
            flowprims: old_dev_flowprims {},
            flowlayout: old_dev_flowlayout {},
            facets: old_dev_facets {},
            code: old_dev_code {},
            viewctx: old_dev_viewctx {},
            git: old_dev_git {},
        },
        fillmore: old_fillmore {
            fillmore: old_fillmore_fillmore {},
            queue: old_fillmore_queue {},
            jobs: old_fillmore_jobs {},
        },
        genmore: old_genmore {
            common: old_genmore_common {},
            ernie: old_genmore_ernie {},
            flux: old_genmore_flux {},
            genmore: old_genmore_genmore {},
            hunyuan: old_genmore_hunyuan {},
            ideogram4: old_genmore_ideogram4 {},
            llm: old_genmore_llm {},
            ltx2: old_genmore_ltx2 {},
            qweni: old_genmore_qweni {},
            sdxl: old_genmore_sdxl {},
            wan: old_genmore_wan {},
            wan22: old_genmore_wan22 {},
            zimg: old_genmore_zimg {},
            krea2: old_genmore_krea2 {},
        },
        grabmore: old_grabmore {
            grabmore: old_grabmore_grabmore {},
            imageproc: old_grabmore_imageproc {},
            selenium: old_grabmore_selenium {},
            tag: old_grabmore_tag {},
            tasks: old_grabmore_tasks {},
            videoproc: old_grabmore_videoproc {},
        },
        gudrun: old_gudrun {
            active: old_gudrun_active {},
            admin: old_gudrun_admin {},
            advanced: old_gudrun_advanced {},
            blank: old_gudrun_blank {},
            blog: old_gudrun_blog {},
            contact: old_gudrun_contact {},
            dataset: old_gudrun_dataset {},
            download_button: old_gudrun_download_button {},
            earlyaccess: old_gudrun_earlyaccess {},
            example: old_gudrun_example {},
            faq: old_gudrun_faq {},
            file_upload: old_gudrun_file_upload {},
            footer: old_gudrun_footer {},
            gudrun: old_gudrun_gudrun {},
            health: old_gudrun_health {},
            history: old_gudrun_history {},
            home: old_gudrun_home {},
            instagram_to_lora: old_gudrun_instagram_to_lora {},
            job: old_gudrun_job {},
            jobs: old_gudrun_jobs {},
            landing: old_gudrun_landing {},
            list_sessions: old_gudrun_list_sessions {},
            log: old_gudrun_log {},
            lora_to_image: old_gudrun_lora_to_image {},
            merge_loras: old_gudrun_merge_loras {},
            promo: old_gudrun_promo {},
            promo_admin: old_gudrun_promo_admin {},
            promo_countdown: old_gudrun_promo_countdown {},
            select_basemodel: old_gudrun_select_basemodel {},
            select_checkpoint: old_gudrun_select_checkpoint {},
            select_dataset: old_gudrun_select_dataset {},
            select_insta: old_gudrun_select_insta {},
            select_urls: old_gudrun_select_urls {},
            social: old_gudrun_social {},
            stats: old_gudrun_stats {},
            storytime: old_gudrun_storytime {},
            subject_selector: old_gudrun_subject_selector {},
            tag_editor: old_gudrun_tag_editor {},
            tip: old_gudrun_tip {},
            tokens: old_gudrun_tokens {},
            topnav: old_gudrun_topnav {},
            train: old_gudrun_train {},
            video_to_lora: old_gudrun_video_to_lora {},
            select_fileupload: old_gudrun_select_fileupload {},
        },
        hagarmap: old_hagarmap {
            hagarmap: old_hagarmap_hagarmap {},
        },
        kb: old_kb {
            platform_api: old_kb_platform_api {},
            workflow: old_kb_workflow {},
            frontend: old_kb_frontend {},
            m2026_07: old_kb_m2026_07 {},
            doctrine: old_kb_doctrine {},
            nebula: old_kb_nebula {},
            camera: old_kb_camera {},
            plan: old_kb_plan {},
        },
        minifig: old_minifig {
            minifig: old_minifig_minifig {},
        },
        nebula: old_nebula {
            lighthouse: old_nebula_lighthouse {},
            nebula: old_nebula_nebula {},
            network: old_nebula_network {},
            member: old_nebula_member {},
        },
        peer: old_peer {
            headsup: old_peer_headsup {},
            peer: old_peer_peer {},
            peer_model: old_peer_peer_model {},
            reboot: old_peer_reboot {},
            service: old_peer_service {},
            peer_select: old_peer_peer_select {},
        },
        runtime: old_runtime {
        },
        security: old_security {
            security: old_security_security {},
        },
        storage: old_storage {
            storage: old_storage_storage {},
        },
        trainmore: old_trainmore {
            common: old_trainmore_common {},
            ernie: old_trainmore_ernie {},
            flux: old_trainmore_flux {},
            flux2: old_trainmore_flux2 {},
            hunyuan: old_trainmore_hunyuan {},
            ideogram4: old_trainmore_ideogram4 {},
            ltx2: old_trainmore_ltx2 {},
            qweni: old_trainmore_qweni {},
            sdxl: old_trainmore_sdxl {},
            trainmore: old_trainmore_trainmore {},
            wan: old_trainmore_wan {},
            wan22: old_trainmore_wan22 {},
            zimg: old_trainmore_zimg {},
            krea2: old_trainmore_krea2 {},
        },
    }
}

impl old_agent_llm {
    #[deprecated(note = "use api::agent::llm::ask_llm instead")]
    pub fn ask_llm(&self, prompt: String, system_prompt: Data) -> String {
        self::agent::llm::ask_llm(prompt, system_prompt)
    }
    #[deprecated(note = "use api::agent::llm::tool_loop instead")]
    pub fn tool_loop(&self, prompt: String) -> DataObject {
        self::agent::llm::tool_loop(prompt)
    }
    #[deprecated(note = "use api::agent::llm::chat_llm instead")]
    pub fn chat_llm(&self, messages: DataArray, tools: DataArray) -> DataObject {
        self::agent::llm::chat_llm(messages, tools)
    }
    #[deprecated(note = "use api::agent::llm::claude_code instead")]
    pub fn claude_code(&self, messages: DataArray, tools: DataArray) -> DataObject {
        self::agent::llm::claude_code(messages, tools)
    }
}
impl old_agent_plugin {
    #[deprecated(note = "use api::agent::plugin::control_query instead")]
    pub fn control_query(&self, message: String, context: DataObject) -> String {
        self::agent::plugin::control_query(message, context)
    }
    #[deprecated(note = "use api::agent::plugin::list_tools instead")]
    pub fn list_tools(&self) -> DataObject {
        self::agent::plugin::list_tools()
    }
    #[deprecated(note = "use api::agent::plugin::describe_command instead")]
    pub fn describe_command(&self, command_name: String, lang: String, returntype: String, groups: String, params: DataArray, imports: String, code: String, current_description: String) -> String {
        self::agent::plugin::describe_command(command_name, lang, returntype, groups, params, imports, code, current_description)
    }
}
impl old_agent_scratch {
    #[deprecated(note = "use api::agent::scratch::eval_pshkms19ee68b2a1ct46 instead")]
    pub fn eval_pshkms19ee68b2a1ct46(&self) -> DataObject {
        self::agent::scratch::eval_pshkms19ee68b2a1ct46()
    }
}
impl old_agent_archivist {
    #[deprecated(note = "use api::agent::archivist::log_turn instead")]
    pub fn log_turn(&self, venue: String, ask: String, reply: String, tools: String, author: String) -> DataObject {
        self::agent::archivist::log_turn(venue, ask, reply, tools, author)
    }
    #[deprecated(note = "use api::agent::archivist::consolidate instead")]
    pub fn consolidate(&self) -> DataObject {
        self::agent::archivist::consolidate()
    }
    #[deprecated(note = "use api::agent::archivist::queue_status instead")]
    pub fn queue_status(&self) -> DataObject {
        self::agent::archivist::queue_status()
    }
    #[deprecated(note = "use api::agent::archivist::remember instead")]
    pub fn remember(&self, lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
        self::agent::archivist::remember(lib, domain, entry, author)
    }
    #[deprecated(note = "use api::agent::archivist::promote instead")]
    pub fn promote(&self, lib: String) -> DataObject {
        self::agent::archivist::promote(lib)
    }
    #[deprecated(note = "use api::agent::archivist::seed_export instead")]
    pub fn seed_export(&self, domains: String, path: String) -> DataObject {
        self::agent::archivist::seed_export(domains, path)
    }
    #[deprecated(note = "use api::agent::archivist::bootstrap instead")]
    pub fn bootstrap(&self, path: String) -> DataObject {
        self::agent::archivist::bootstrap(path)
    }
    #[deprecated(note = "use api::agent::archivist::recall instead")]
    pub fn recall(&self, query: String, domains: String, limit: i64) -> DataObject {
        self::agent::archivist::recall(query, domains, limit)
    }
    #[deprecated(note = "use api::agent::archivist::adjudicate instead")]
    pub fn adjudicate(&self, lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
        self::agent::archivist::adjudicate(lib, domain, entry, author)
    }
    #[deprecated(note = "use api::agent::archivist::epistemic_work instead")]
    pub fn epistemic_work(&self) -> DataObject {
        self::agent::archivist::epistemic_work()
    }
    #[deprecated(note = "use api::agent::archivist::decay instead")]
    pub fn decay(&self, lib: String, domain: String, claim: String, author: String) -> DataObject {
        self::agent::archivist::decay(lib, domain, claim, author)
    }
    #[deprecated(note = "use api::agent::archivist::reverify instead")]
    pub fn reverify(&self, limit: i64) -> DataObject {
        self::agent::archivist::reverify(limit)
    }
    #[deprecated(note = "use api::agent::archivist::connect instead")]
    pub fn connect(&self, subject: String) -> DataObject {
        self::agent::archivist::connect(subject)
    }
    #[deprecated(note = "use api::agent::archivist::wonder instead")]
    pub fn wonder(&self) -> DataObject {
        self::agent::archivist::wonder()
    }
}
impl old_agent_chat {
    #[deprecated(note = "use api::agent::chat::upload instead")]
    pub fn upload(&self, filename: String, data_b64: String) -> DataObject {
        self::agent::chat::upload(filename, data_b64)
    }
}
impl old_agent_executive {
    #[deprecated(note = "use api::agent::executive::start instead")]
    pub fn start(&self) -> DataObject {
        self::agent::executive::start()
    }
    #[deprecated(note = "use api::agent::executive::stop instead")]
    pub fn stop(&self) -> DataObject {
        self::agent::executive::stop()
    }
    #[deprecated(note = "use api::agent::executive::status instead")]
    pub fn status(&self) -> DataObject {
        self::agent::executive::status()
    }
    #[deprecated(note = "use api::agent::executive::perceive instead")]
    pub fn perceive(&self, perception: DataObject) -> DataObject {
        self::agent::executive::perceive(perception)
    }
    #[deprecated(note = "use api::agent::executive::set_drive instead")]
    pub fn set_drive(&self, acts_per_hour: i64) -> DataObject {
        self::agent::executive::set_drive(acts_per_hour)
    }
    #[deprecated(note = "use api::agent::executive::salience_log instead")]
    pub fn salience_log(&self) -> DataObject {
        self::agent::executive::salience_log()
    }
    #[deprecated(note = "use api::agent::executive::consolidate_room instead")]
    pub fn consolidate_room(&self, min_quiet_s: i64, window: i64, budget: i64) -> DataObject {
        self::agent::executive::consolidate_room(min_quiet_s, window, budget)
    }
}
impl old_agent_sensor {
    #[deprecated(note = "use api::agent::sensor::start instead")]
    pub fn start(&self) -> DataObject {
        self::agent::sensor::start()
    }
    #[deprecated(note = "use api::agent::sensor::stop instead")]
    pub fn stop(&self) -> DataObject {
        self::agent::sensor::stop()
    }
    #[deprecated(note = "use api::agent::sensor::status instead")]
    pub fn status(&self) -> DataObject {
        self::agent::sensor::status()
    }
    #[deprecated(note = "use api::agent::sensor::system_sense instead")]
    pub fn system_sense(&self) -> DataObject {
        self::agent::sensor::system_sense()
    }
    #[deprecated(note = "use api::agent::sensor::git_sense instead")]
    pub fn git_sense(&self) -> DataObject {
        self::agent::sensor::git_sense()
    }
}
impl old_agent_model {
    #[deprecated(note = "use api::agent::model::salience instead")]
    pub fn salience(&self, perception: DataObject, context: DataObject) -> DataObject {
        self::agent::model::salience(perception, context)
    }
    #[deprecated(note = "use api::agent::model::service_status instead")]
    pub fn service_status(&self) -> DataObject {
        self::agent::model::service_status()
    }
    #[deprecated(note = "use api::agent::model::curriculum_export instead")]
    pub fn curriculum_export(&self, path: String) -> DataObject {
        self::agent::model::curriculum_export(path)
    }
    #[deprecated(note = "use api::agent::model::bootstrap instead")]
    pub fn bootstrap(&self) -> DataObject {
        self::agent::model::bootstrap()
    }
    #[deprecated(note = "use api::agent::model::train_status instead")]
    pub fn train_status(&self) -> DataObject {
        self::agent::model::train_status()
    }
    #[deprecated(note = "use api::agent::model::get_settings instead")]
    pub fn get_settings(&self) -> DataObject {
        self::agent::model::get_settings()
    }
    #[deprecated(note = "use api::agent::model::set_setting instead")]
    pub fn set_setting(&self, key: String, value: String) -> DataObject {
        self::agent::model::set_setting(key, value)
    }
    #[deprecated(note = "use api::agent::model::promote_pointer instead")]
    pub fn promote_pointer(&self) -> DataObject {
        self::agent::model::promote_pointer()
    }
    #[deprecated(note = "use api::agent::model::metrics instead")]
    pub fn metrics(&self) -> DataObject {
        self::agent::model::metrics()
    }
    #[deprecated(note = "use api::agent::model::service_stop instead")]
    pub fn service_stop(&self) -> DataObject {
        self::agent::model::service_stop()
    }
    #[deprecated(note = "use api::agent::model::user_promote instead")]
    pub fn user_promote(&self) -> DataObject {
        self::agent::model::user_promote()
    }
    #[deprecated(note = "use api::agent::model::user_rollback instead")]
    pub fn user_rollback(&self) -> DataObject {
        self::agent::model::user_rollback()
    }
    #[deprecated(note = "use api::agent::model::persona_rederive instead")]
    pub fn persona_rederive(&self) -> DataObject {
        self::agent::model::persona_rederive()
    }
    #[deprecated(note = "use api::agent::model::persona_read instead")]
    pub fn persona_read(&self) -> DataObject {
        self::agent::model::persona_read()
    }
    #[deprecated(note = "use api::agent::model::persona_write instead")]
    pub fn persona_write(&self, content: String) -> DataObject {
        self::agent::model::persona_write(content)
    }
    #[deprecated(note = "use api::agent::model::import instead")]
    pub fn import(&self, name: String, source: String, backend: String, anchor: String) -> DataObject {
        self::agent::model::import(name, source, backend, anchor)
    }
    #[deprecated(note = "use api::agent::model::models instead")]
    pub fn models(&self) -> DataObject {
        self::agent::model::models()
    }
    #[deprecated(note = "use api::agent::model::model_remove instead")]
    pub fn model_remove(&self, name: String, purge: bool) -> DataObject {
        self::agent::model::model_remove(name, purge)
    }
    #[deprecated(note = "use api::agent::model::resources instead")]
    pub fn resources(&self) -> DataObject {
        self::agent::model::resources()
    }
    #[deprecated(note = "use api::agent::model::dataset_add instead")]
    pub fn dataset_add(&self, name: String, source: String, kind: String, format: String, holdout_every: i64, mode: String) -> DataObject {
        self::agent::model::dataset_add(name, source, kind, format, holdout_every, mode)
    }
    #[deprecated(note = "use api::agent::model::dataset_list instead")]
    pub fn dataset_list(&self) -> DataObject {
        self::agent::model::dataset_list()
    }
    #[deprecated(note = "use api::agent::model::dataset_inspect instead")]
    pub fn dataset_inspect(&self, name: String, peek: i64, verify: bool) -> DataObject {
        self::agent::model::dataset_inspect(name, peek, verify)
    }
    #[deprecated(note = "use api::agent::model::dataset_snapshot instead")]
    pub fn dataset_snapshot(&self, name: String, snapshot_name: String) -> DataObject {
        self::agent::model::dataset_snapshot(name, snapshot_name)
    }
    #[deprecated(note = "use api::agent::model::dataset_derive instead")]
    pub fn dataset_derive(&self, name: String, out_name: String, transform: String, limit: i64) -> DataObject {
        self::agent::model::dataset_derive(name, out_name, transform, limit)
    }
    #[deprecated(note = "use api::agent::model::dataset_remove instead")]
    pub fn dataset_remove(&self, name: String, purge: bool) -> DataObject {
        self::agent::model::dataset_remove(name, purge)
    }
    #[deprecated(note = "use api::agent::model::adapter_derive instead")]
    pub fn adapter_derive(&self, name: String, dataset: String, base: String, targets: String, rank: i64, steps: i64) -> DataObject {
        self::agent::model::adapter_derive(name, dataset, base, targets, rank, steps)
    }
    #[deprecated(note = "use api::agent::model::adapter_apply instead")]
    pub fn adapter_apply(&self, name: String, on: bool) -> DataObject {
        self::agent::model::adapter_apply(name, on)
    }
    #[deprecated(note = "use api::agent::model::adapters instead")]
    pub fn adapters(&self) -> DataObject {
        self::agent::model::adapters()
    }
    #[deprecated(note = "use api::agent::model::adapter_delete instead")]
    pub fn adapter_delete(&self, name: String) -> DataObject {
        self::agent::model::adapter_delete(name)
    }
    #[deprecated(note = "use api::agent::model::recipe_author instead")]
    pub fn recipe_author(&self, name: String, base: String, mix: String, posture: String, steps: i64, lr: String, evals: String, notes: String) -> DataObject {
        self::agent::model::recipe_author(name, base, mix, posture, steps, lr, evals, notes)
    }
    #[deprecated(note = "use api::agent::model::recipe_clone instead")]
    pub fn recipe_clone(&self, name: String, from: String, edits: DataObject) -> DataObject {
        self::agent::model::recipe_clone(name, from, edits)
    }
    #[deprecated(note = "use api::agent::model::recipes instead")]
    pub fn recipes(&self) -> DataObject {
        self::agent::model::recipes()
    }
    #[deprecated(note = "use api::agent::model::recipe_remove instead")]
    pub fn recipe_remove(&self, name: String) -> DataObject {
        self::agent::model::recipe_remove(name)
    }
    #[deprecated(note = "use api::agent::model::experiment instead")]
    pub fn experiment(&self, name: String, control: String, variant: String, budget_steps: i64) -> DataObject {
        self::agent::model::experiment(name, control, variant, budget_steps)
    }
    #[deprecated(note = "use api::agent::model::experiments instead")]
    pub fn experiments(&self) -> DataObject {
        self::agent::model::experiments()
    }
    #[deprecated(note = "use api::agent::model::sft_run instead")]
    pub fn sft_run(&self, name: String, dataset: String, base: String, rank: i64, steps: i64) -> DataObject {
        self::agent::model::sft_run(name, dataset, base, rank, steps)
    }
    #[deprecated(note = "use api::agent::model::sft_promote instead")]
    pub fn sft_promote(&self, checkpoint: String) -> DataObject {
        self::agent::model::sft_promote(checkpoint)
    }
    #[deprecated(note = "use api::agent::model::dataset_feed instead")]
    pub fn dataset_feed(&self, name: String, kind: String, lines: String, lineage: String, provenance: String, holdout_every: i64) -> DataObject {
        self::agent::model::dataset_feed(name, kind, lines, lineage, provenance, holdout_every)
    }
    #[deprecated(note = "use api::agent::model::why_harvest instead")]
    pub fn why_harvest(&self, source: String, repo_path: String, limit: i64) -> DataObject {
        self::agent::model::why_harvest(source, repo_path, limit)
    }
    #[deprecated(note = "use api::agent::model::harvest_report instead")]
    pub fn harvest_report(&self, window_days: i64) -> DataObject {
        self::agent::model::harvest_report(window_days)
    }
}
impl old_agent_msg {
    #[deprecated(note = "use api::agent::msg::put instead")]
    pub fn put(&self, role: String, venue: String, content: String, entity: String, provenance: String, id: String) -> DataObject {
        self::agent::msg::put(role, venue, content, entity, provenance, id)
    }
    #[deprecated(note = "use api::agent::msg::get instead")]
    pub fn get(&self, id: String) -> DataObject {
        self::agent::msg::get(id)
    }
    #[deprecated(note = "use api::agent::msg::recent instead")]
    pub fn recent(&self, venue: String, limit: i64) -> DataObject {
        self::agent::msg::recent(venue, limit)
    }
}
impl old_agent_context {
    #[deprecated(note = "use api::agent::context::assemble instead")]
    pub fn assemble(&self, purpose: String, subject: String, budget: i64) -> DataObject {
        self::agent::context::assemble(purpose, subject, budget)
    }
}
impl old_agent_tools {
    #[deprecated(note = "use api::agent::tools::ssh_run instead")]
    pub fn ssh_run(&self, host: String, cmd: String, timeout_secs: i64) -> DataObject {
        self::agent::tools::ssh_run(host, cmd, timeout_secs)
    }
    #[deprecated(note = "use api::agent::tools::rsync_push instead")]
    pub fn rsync_push(&self, host: String, src: String, dst: String) -> DataObject {
        self::agent::tools::rsync_push(host, src, dst)
    }
}
impl old_agent_plan {
    #[deprecated(note = "use api::agent::plan::board instead")]
    pub fn board(&self) -> DataObject {
        self::agent::plan::board()
    }
    #[deprecated(note = "use api::agent::plan::move_item instead")]
    pub fn move_item(&self, claim: String, lifecycle: String, base: String, nn_sessionid: String) -> DataObject {
        self::agent::plan::move_item(claim, lifecycle, base, nn_sessionid)
    }
    #[deprecated(note = "use api::agent::plan::add_item instead")]
    pub fn add_item(&self, claim: String, detail: String, nn_sessionid: String) -> DataObject {
        self::agent::plan::add_item(claim, detail, nn_sessionid)
    }
}
impl old_agent_browser {
    #[deprecated(note = "use api::agent::browser::eval instead")]
    pub fn eval(&self, js: String, timeout_ms: i64) -> DataObject {
        self::agent::browser::eval(js, timeout_ms)
    }
    #[deprecated(note = "use api::agent::browser::open instead")]
    pub fn open(&self, url: String) -> DataObject {
        self::agent::browser::open(url)
    }
    #[deprecated(note = "use api::agent::browser::goto instead")]
    pub fn goto(&self, url: String) -> DataObject {
        self::agent::browser::goto(url)
    }
    #[deprecated(note = "use api::agent::browser::text instead")]
    pub fn text(&self, selector: String) -> DataObject {
        self::agent::browser::text(selector)
    }
    #[deprecated(note = "use api::agent::browser::click instead")]
    pub fn click(&self, selector: String) -> DataObject {
        self::agent::browser::click(selector)
    }
    #[deprecated(note = "use api::agent::browser::fill instead")]
    pub fn fill(&self, selector: String, value: String) -> DataObject {
        self::agent::browser::fill(selector, value)
    }
    #[deprecated(note = "use api::agent::browser::wait_for instead")]
    pub fn wait_for(&self, selector: String, timeout_ms: i64) -> DataObject {
        self::agent::browser::wait_for(selector, timeout_ms)
    }
    #[deprecated(note = "use api::agent::browser::close instead")]
    pub fn close(&self) -> DataObject {
        self::agent::browser::close()
    }
    #[deprecated(note = "use api::agent::browser::screenshot instead")]
    pub fn screenshot(&self, url: String, path: String, width: i64, height: i64) -> DataObject {
        self::agent::browser::screenshot(url, path, width, height)
    }
}
impl old_agent_browser_builder {
    #[deprecated(note = "use api::agent::browser_builder::builder_status instead")]
    pub fn builder_status(&self) -> DataObject {
        self::agent::browser_builder::builder_status()
    }
    #[deprecated(note = "use api::agent::browser_builder::set_config instead")]
    pub fn set_config(&self, key: String, value: String) -> DataObject {
        self::agent::browser_builder::set_config(key, value)
    }
    #[deprecated(note = "use api::agent::browser_builder::materialize_kit instead")]
    pub fn materialize_kit(&self) -> DataObject {
        self::agent::browser_builder::materialize_kit()
    }
    #[deprecated(note = "use api::agent::browser_builder::apply_patch instead")]
    pub fn apply_patch(&self) -> DataObject {
        self::agent::browser_builder::apply_patch()
    }
    #[deprecated(note = "use api::agent::browser_builder::run_stage instead")]
    pub fn run_stage(&self, stage: String) -> DataObject {
        self::agent::browser_builder::run_stage(stage)
    }
    #[deprecated(note = "use api::agent::browser_builder::stage_log instead")]
    pub fn stage_log(&self, tail_lines: i64) -> DataObject {
        self::agent::browser_builder::stage_log(tail_lines)
    }
    #[deprecated(note = "use api::agent::browser_builder::stop_build instead")]
    pub fn stop_build(&self) -> DataObject {
        self::agent::browser_builder::stop_build()
    }
    #[deprecated(note = "use api::agent::browser_builder::install instead")]
    pub fn install(&self, mode: String) -> DataObject {
        self::agent::browser_builder::install(mode)
    }
    #[deprecated(note = "use api::agent::browser_builder::repatch instead")]
    pub fn repatch(&self) -> DataObject {
        self::agent::browser_builder::repatch()
    }
}
impl old_app_app {
    #[deprecated(note = "use api::app::app::apps instead")]
    pub fn apps(&self) -> DataArray {
        self::app::app::apps()
    }
    #[deprecated(note = "use api::app::app::asset instead")]
    pub fn asset(&self, nn_path: String) -> String {
        self::app::app::asset(nn_path)
    }
    #[deprecated(note = "use api::app::app::assets instead")]
    pub fn assets(&self, lib: String) -> DataArray {
        self::app::app::assets(lib)
    }
    #[deprecated(note = "use api::app::app::delete instead")]
    pub fn delete(&self, lib: String, id: String, nn_sessionid: String) -> String {
        self::app::app::delete(lib, id, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::deletelib instead")]
    pub fn deletelib(&self, lib: String) -> String {
        self::app::app::deletelib(lib)
    }
    #[deprecated(note = "use api::app::app::deviceid instead")]
    pub fn deviceid(&self) -> String {
        self::app::app::deviceid()
    }
    #[deprecated(note = "use api::app::app::eventoff instead")]
    pub fn eventoff(&self, id: String) -> String {
        self::app::app::eventoff(id)
    }
    #[deprecated(note = "use api::app::app::eventon instead")]
    pub fn eventon(&self, id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
        self::app::app::eventon(id, app, event, cmdlib, cmdid)
    }
    #[deprecated(note = "use api::app::app::events instead")]
    pub fn events(&self, app: String) -> DataArray {
        self::app::app::events(app)
    }
    #[deprecated(note = "use api::app::app::exec instead")]
    pub fn exec(&self, lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
        self::app::app::exec(lib, id, args, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::jsapi instead")]
    pub fn jsapi(&self, nn_path: String) -> DataObject {
        self::app::app::jsapi(nn_path)
    }
    #[deprecated(note = "use api::app::app::libs instead")]
    pub fn libs(&self) -> DataArray {
        self::app::app::libs()
    }
    #[deprecated(note = "use api::app::app::login instead")]
    pub fn login(&self, user: String, pass: String, nn_sessionid: String) -> DataObject {
        self::app::app::login(user, pass, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::newlib instead")]
    pub fn newlib(&self, lib: String, readers: DataArray, writers: DataArray) -> String {
        self::app::app::newlib(lib, readers, writers)
    }
    #[deprecated(note = "use api::app::app::read instead")]
    pub fn read(&self, lib: String, id: String, nn_sessionid: String) -> DataObject {
        self::app::app::read(lib, id, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::remembersession instead")]
    pub fn remembersession(&self, nn_session: DataObject) -> String {
        self::app::app::remembersession(nn_session)
    }
    #[deprecated(note = "use api::app::app::settings instead")]
    pub fn settings(&self, settings: Data) -> DataObject {
        self::app::app::settings(settings)
    }
    #[deprecated(note = "use api::app::app::spawn instead")]
    pub fn spawn(&self, lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
        self::app::app::spawn(lib, ctl, cmd, args)
    }
    #[deprecated(note = "use api::app::app::timeroff instead")]
    pub fn timeroff(&self, id: String) -> String {
        self::app::app::timeroff(id)
    }
    #[deprecated(note = "use api::app::app::timeron instead")]
    pub fn timeron(&self, id: String, data: DataObject) -> String {
        self::app::app::timeron(id, data)
    }
    #[deprecated(note = "use api::app::app::uninstall instead")]
    pub fn uninstall(&self, app: String) -> String {
        self::app::app::uninstall(app)
    }
    #[deprecated(note = "use api::app::app::unique_session_id instead")]
    pub fn unique_session_id(&self) -> String {
        self::app::app::unique_session_id()
    }
    #[deprecated(note = "use api::app::app::write instead")]
    pub fn write(&self, lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
        self::app::app::write(lib, id, data, readers, writers, nn_sessionid)
    }
}
impl old_app_service {
    #[deprecated(note = "use api::app::service::init instead")]
    pub fn init(&self) -> String {
        self::app::service::init()
    }
}
impl old_app_util {
    #[deprecated(note = "use api::app::util::hash instead")]
    pub fn hash(&self, file: String) -> String {
        self::app::util::hash(file)
    }
    #[deprecated(note = "use api::app::util::init instead")]
    pub fn init(&self) -> String {
        self::app::util::init()
    }
    #[deprecated(note = "use api::app::util::zip instead")]
    pub fn zip(&self, srcdir: String, destfile: String) -> bool {
        self::app::util::zip(srcdir, destfile)
    }
}
impl old_dev_dev {
    #[deprecated(note = "use api::dev::dev::check instead")]
    pub fn check(&self, lib: String, ctl: String, cmd: String) -> String {
        self::dev::dev::check(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::dev::compile instead")]
    pub fn compile(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::dev::compile(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::dev::compile_rust instead")]
    pub fn compile_rust(&self) -> String {
        self::dev::dev::compile_rust()
    }
    #[deprecated(note = "use api::dev::dev::install_lib instead")]
    pub fn install_lib(&self, uuid: String, lib: String) -> bool {
        self::dev::dev::install_lib(uuid, lib)
    }
    #[deprecated(note = "use api::dev::dev::lib_archive instead")]
    pub fn lib_archive(&self, lib: String, version: i64) -> String {
        self::dev::dev::lib_archive(lib, version)
    }
    #[deprecated(note = "use api::dev::dev::lib_info instead")]
    pub fn lib_info(&self, lib: String) -> DataObject {
        self::dev::dev::lib_info(lib)
    }
    #[deprecated(note = "use api::dev::dev::rebuild_lib instead")]
    pub fn rebuild_lib(&self, lib: String) -> String {
        self::dev::dev::rebuild_lib(lib)
    }
    #[deprecated(note = "use api::dev::dev::activate_lib instead")]
    pub fn activate_lib(&self, lib: String) -> String {
        self::dev::dev::activate_lib(lib)
    }
    #[deprecated(note = "use api::dev::dev::crate_versions instead")]
    pub fn crate_versions(&self) -> DataObject {
        self::dev::dev::crate_versions()
    }
    #[deprecated(note = "use api::dev::dev::update_crates instead")]
    pub fn update_crates(&self, flowlang: String, ndata: String) -> DataObject {
        self::dev::dev::update_crates(flowlang, ndata)
    }
    #[deprecated(note = "use api::dev::dev::update_crates_status instead")]
    pub fn update_crates_status(&self) -> DataObject {
        self::dev::dev::update_crates_status()
    }
    #[deprecated(note = "use api::dev::dev::restart_instance instead")]
    pub fn restart_instance(&self) -> String {
        self::dev::dev::restart_instance()
    }
    #[deprecated(note = "use api::dev::dev::hard_reset instead")]
    pub fn hard_reset(&self, url: String) -> DataObject {
        self::dev::dev::hard_reset(url)
    }
}
impl old_dev_editcommand {
    #[deprecated(note = "use api::dev::editcommand::compile_command instead")]
    pub fn compile_command(&self, lib: String, control_name: String, cmd_name: String) -> DataObject {
        self::dev::editcommand::compile_command(lib, control_name, cmd_name)
    }
    #[deprecated(note = "use api::dev::editcommand::delete_command instead")]
    pub fn delete_command(&self, lib: String, control_id: String, cmd_id: String, nn_sessionid: String) -> String {
        self::dev::editcommand::delete_command(lib, control_id, cmd_id, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcommand::save_command instead")]
    pub fn save_command(&self, lib: String, cmd_id: String, lang: String, code: String, imports: String, returntype: String, params: DataArray, desc: String, groups: String, readers: DataArray, nn_sessionid: String) -> String {
        self::dev::editcommand::save_command(lib, cmd_id, lang, code, imports, returntype, params, desc, groups, readers, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcommand::read_command instead")]
    pub fn read_command(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::editcommand::read_command(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::editcommand::lookup_cmd_id instead")]
    pub fn lookup_cmd_id(&self, lib: String, ctl: String, cmd: String) -> String {
        self::dev::editcommand::lookup_cmd_id(lib, ctl, cmd)
    }
}
impl old_dev_editcontrol {
    #[deprecated(note = "use api::dev::editcontrol::add_component instead")]
    pub fn add_component(&self, lib: String, control_id: String, component_type: String, name: String, nn_sessionid: String) -> DataObject {
        self::dev::editcontrol::add_component(lib, control_id, component_type, name, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcontrol::appdata instead")]
    pub fn appdata(&self, data: DataObject) -> DataObject {
        self::dev::editcontrol::appdata(data)
    }
    #[deprecated(note = "use api::dev::editcontrol::get_control instead")]
    pub fn get_control(&self, lib: String, id: String) -> DataObject {
        self::dev::editcontrol::get_control(lib, id)
    }
    #[deprecated(note = "use api::dev::editcontrol::get_publish_context instead")]
    pub fn get_publish_context(&self, lib: String, control_id: String, nn_sessionid: String) -> DataObject {
        self::dev::editcontrol::get_publish_context(lib, control_id, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcontrol::lookup_id instead")]
    pub fn lookup_id(&self, lib: String, name: String) -> String {
        self::dev::editcontrol::lookup_id(lib, name)
    }
    #[deprecated(note = "use api::dev::editcontrol::publishapp instead")]
    pub fn publishapp(&self, data: DataObject) -> DataArray {
        self::dev::editcontrol::publishapp(data)
    }
    #[deprecated(note = "use api::dev::editcontrol::save_control instead")]
    pub fn save_control(&self, lib: String, id: String, html: String, css: String, js: String, groups: String, desc: String, readers: DataArray, inline_data: DataObject, nn_sessionid: String) -> String {
        self::dev::editcontrol::save_control(lib, id, html, css, js, groups, desc, readers, inline_data, nn_sessionid)
    }
}
impl old_dev_github {
    #[deprecated(note = "use api::dev::github::import instead")]
    pub fn import(&self, url: String) -> String {
        self::dev::github::import(url)
    }
    #[deprecated(note = "use api::dev::github::list instead")]
    pub fn list(&self) -> DataObject {
        self::dev::github::list()
    }
    #[deprecated(note = "use api::dev::github::update instead")]
    pub fn update(&self, lib: String) -> String {
        self::dev::github::update(lib)
    }
    #[deprecated(note = "use api::dev::github::remove instead")]
    pub fn remove(&self, lib: String, delete_repository: bool) -> String {
        self::dev::github::remove(lib, delete_repository)
    }
}
impl old_dev_libsettings {
    #[deprecated(note = "use api::dev::libsettings::get_library_config instead")]
    pub fn get_library_config(&self, id: String) -> DataObject {
        self::dev::libsettings::get_library_config(id)
    }
    #[deprecated(note = "use api::dev::libsettings::save_library_config instead")]
    pub fn save_library_config(&self, data: DataObject) -> DataObject {
        self::dev::libsettings::save_library_config(data)
    }
}
impl old_dev_plugins {
    #[deprecated(note = "use api::dev::plugins::list_plugins instead")]
    pub fn list_plugins(&self) -> DataObject {
        self::dev::plugins::list_plugins()
    }
}
impl old_dev_code {
    #[deprecated(note = "use api::dev::code::list_commands instead")]
    pub fn list_commands(&self, lib: String, ctl: String) -> DataArray {
        self::dev::code::list_commands(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::list_controls instead")]
    pub fn list_controls(&self, lib: String) -> DataArray {
        self::dev::code::list_controls(lib)
    }
    #[deprecated(note = "use api::dev::code::list_libraries instead")]
    pub fn list_libraries(&self) -> DataArray {
        self::dev::code::list_libraries()
    }
    #[deprecated(note = "use api::dev::code::add_library instead")]
    pub fn add_library(&self, lib: String) -> String {
        self::dev::code::add_library(lib)
    }
    #[deprecated(note = "use api::dev::code::add_control instead")]
    pub fn add_control(&self, lib: String, ctl: String) -> String {
        self::dev::code::add_control(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::upsert_command instead")]
    pub fn upsert_command(&self, lib: String, ctl: String, cmd: String, lang: String, return_type: String, params: DataArray, imports: String, code_body: String) -> DataObject {
        self::dev::code::upsert_command(lib, ctl, cmd, lang, return_type, params, imports, code_body)
    }
    #[deprecated(note = "use api::dev::code::patch_command_body instead")]
    pub fn patch_command_body(&self, lib: String, ctl: String, cmd: String, old_snippet: String, new_snippet: String) -> DataObject {
        self::dev::code::patch_command_body(lib, ctl, cmd, old_snippet, new_snippet)
    }
    #[deprecated(note = "use api::dev::code::read_command instead")]
    pub fn read_command(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::code::read_command(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::code::delete_command instead")]
    pub fn delete_command(&self, lib: String, ctl: String, cmd: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::delete_command(lib, ctl, cmd, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::search_commands instead")]
    pub fn search_commands(&self, lib: String, ctl: String, query: String) -> DataArray {
        self::dev::code::search_commands(lib, ctl, query)
    }
    #[deprecated(note = "use api::dev::code::invoke_command instead")]
    pub fn invoke_command(&self, lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
        self::dev::code::invoke_command(lib, ctl, cmd, args)
    }
    #[deprecated(note = "use api::dev::code::evaluate_rust instead")]
    pub fn evaluate_rust(&self, imports: String, code: String) -> DataObject {
        self::dev::code::evaluate_rust(imports, code)
    }
    #[deprecated(note = "use api::dev::code::read_control_facet instead")]
    pub fn read_control_facet(&self, lib: String, ctl: String, facet: String) -> DataObject {
        self::dev::code::read_control_facet(lib, ctl, facet)
    }
    #[deprecated(note = "use api::dev::code::patch_control_facet instead")]
    pub fn patch_control_facet(&self, lib: String, ctl: String, facet: String, old_snippet: String, new_snippet: String, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::patch_control_facet(lib, ctl, facet, old_snippet, new_snippet, base, label, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::list_control_patches instead")]
    pub fn list_control_patches(&self, lib: String, ctl: String, limit: i64) -> DataObject {
        self::dev::code::list_control_patches(lib, ctl, limit)
    }
    #[deprecated(note = "use api::dev::code::set_library_meta instead")]
    pub fn set_library_meta(&self, lib: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_library_meta(lib, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::set_control_meta instead")]
    pub fn set_control_meta(&self, lib: String, ctl: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_control_meta(lib, ctl, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::set_command_meta instead")]
    pub fn set_command_meta(&self, lib: String, ctl: String, cmd: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_command_meta(lib, ctl, cmd, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::list_assets instead")]
    pub fn list_assets(&self, lib: String) -> DataObject {
        self::dev::code::list_assets(lib)
    }
    #[deprecated(note = "use api::dev::code::write_asset instead")]
    pub fn write_asset(&self, lib: String, name: String, content: String, tempfile: String) -> DataObject {
        self::dev::code::write_asset(lib, name, content, tempfile)
    }
    #[deprecated(note = "use api::dev::code::rename_asset instead")]
    pub fn rename_asset(&self, lib: String, from: String, to: String) -> DataObject {
        self::dev::code::rename_asset(lib, from, to)
    }
    #[deprecated(note = "use api::dev::code::delete_asset instead")]
    pub fn delete_asset(&self, lib: String, name: String) -> DataObject {
        self::dev::code::delete_asset(lib, name)
    }
    #[deprecated(note = "use api::dev::code::read_flow_body instead")]
    pub fn read_flow_body(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::code::read_flow_body(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::code::write_flow_body instead")]
    pub fn write_flow_body(&self, lib: String, ctl: String, cmd: String, body: DataObject, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::write_flow_body(lib, ctl, cmd, body, base, label, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_timer instead")]
    pub fn set_timer(&self, lib: String, ctl: String, name: String, cmd: String, start: i64, startunit: String, interval: i64, intervalunit: String, repeat: bool, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_timer(lib, ctl, name, cmd, start, startunit, interval, intervalunit, repeat, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::remove_timer instead")]
    pub fn remove_timer(&self, lib: String, ctl: String, name: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::remove_timer(lib, ctl, name, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_event_handler instead")]
    pub fn set_event_handler(&self, lib: String, ctl: String, name: String, bot: String, event: String, cmd: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_event_handler(lib, ctl, name, bot, event, cmd, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::remove_event_handler instead")]
    pub fn remove_event_handler(&self, lib: String, ctl: String, name: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::remove_event_handler(lib, ctl, name, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::read_control_scene instead")]
    pub fn read_control_scene(&self, lib: String, ctl: String) -> DataObject {
        self::dev::code::read_control_scene(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::write_control_scene instead")]
    pub fn write_control_scene(&self, lib: String, ctl: String, scene: DataObject, base: String, label: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::write_control_scene(lib, ctl, scene, base, label, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::delete_library instead")]
    pub fn delete_library(&self, lib: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::delete_library(lib, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::delete_control instead")]
    pub fn delete_control(&self, lib: String, ctl: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::delete_control(lib, ctl, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::move_control instead")]
    pub fn move_control(&self, lib: String, ctl: String, to_lib: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::move_control(lib, ctl, to_lib, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_meta_identity instead")]
    pub fn set_meta_identity(&self, displayname: String, organization: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_meta_identity(displayname, organization, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::get_meta_identity instead")]
    pub fn get_meta_identity(&self) -> DataObject {
        self::dev::code::get_meta_identity()
    }
    #[deprecated(note = "use api::dev::code::unpublish_app instead")]
    pub fn unpublish_app(&self, lib: String, app: String, remove_runtime: bool, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::unpublish_app(lib, app, remove_runtime, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_plugin instead")]
    pub fn set_plugin(&self, name: String, target_lib: String, target_ctl: String, plugin_lib: String, plugin_ctl: String, selector: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_plugin(name, target_lib, target_ctl, plugin_lib, plugin_ctl, selector, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::remove_plugin instead")]
    pub fn remove_plugin(&self, name: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::remove_plugin(name, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_tags instead")]
    pub fn set_tags(&self, lib: String, ctl: String, cmd: String, tags: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_tags(lib, ctl, cmd, tags, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_groups instead")]
    pub fn set_groups(&self, lib: String, ctl: String, cmd: String, groups: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::code::set_groups(lib, ctl, cmd, groups, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::code::set_command_imports instead")]
    pub fn set_command_imports(&self, lib: String, ctl: String, cmd: String, imports: String) -> DataObject {
        self::dev::code::set_command_imports(lib, ctl, cmd, imports)
    }
    #[deprecated(note = "use api::dev::code::init instead")]
    pub fn init(&self) -> DataObject {
        self::dev::code::init()
    }
}
impl old_dev_git {
    #[deprecated(note = "use api::dev::git::gitrun instead")]
    pub fn gitrun(&self, repo: String, verb: String, args: DataArray, mode: String) -> DataObject {
        self::dev::git::gitrun(repo, verb, args, mode)
    }
    #[deprecated(note = "use api::dev::git::read instead")]
    pub fn read(&self, repo: String, verb: String, args: DataArray) -> DataObject {
        self::dev::git::read(repo, verb, args)
    }
    #[deprecated(note = "use api::dev::git::write instead")]
    pub fn write(&self, repo: String, verb: String, args: DataArray) -> DataObject {
        self::dev::git::write(repo, verb, args)
    }
    #[deprecated(note = "use api::dev::git::remote_op instead")]
    pub fn remote_op(&self, repo: String, verb: String, args: DataArray) -> DataObject {
        self::dev::git::remote_op(repo, verb, args)
    }
    #[deprecated(note = "use api::dev::git::set_repo instead")]
    pub fn set_repo(&self, name: String, path: String, origin: String, role: String, autocommit: bool, author: String, nn_sessionid: String) -> DataObject {
        self::dev::git::set_repo(name, path, origin, role, autocommit, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::git::remove_repo instead")]
    pub fn remove_repo(&self, name: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::git::remove_repo(name, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::git::repos instead")]
    pub fn repos(&self) -> DataObject {
        self::dev::git::repos()
    }
    #[deprecated(note = "use api::dev::git::autocommit_sweep instead")]
    pub fn autocommit_sweep(&self) -> DataObject {
        self::dev::git::autocommit_sweep()
    }
    #[deprecated(note = "use api::dev::git::merge_to_master instead")]
    pub fn merge_to_master(&self, repo: String, branch: String) -> DataObject {
        self::dev::git::merge_to_master(repo, branch)
    }
    #[deprecated(note = "use api::dev::git::abandon_branch instead")]
    pub fn abandon_branch(&self, repo: String, branch: String, discard: bool, delete_remote: bool, next_branch: String) -> DataObject {
        self::dev::git::abandon_branch(repo, branch, discard, delete_remote, next_branch)
    }
    #[deprecated(note = "use api::dev::git::set_autocommit instead")]
    pub fn set_autocommit(&self, name: String, autocommit: bool) -> DataObject {
        self::dev::git::set_autocommit(name, autocommit)
    }
    #[deprecated(note = "use api::dev::git::store_status instead")]
    pub fn store_status(&self, repo: String) -> DataObject {
        self::dev::git::store_status(repo)
    }
    #[deprecated(note = "use api::dev::git::commit_unit instead")]
    pub fn commit_unit(&self, repo: String, lib: String, ctl: String, message: String, author: String, nn_sessionid: String) -> DataObject {
        self::dev::git::commit_unit(repo, lib, ctl, message, author, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::git::repo_state instead")]
    pub fn repo_state(&self, repo: String, fetch: bool) -> DataObject {
        self::dev::git::repo_state(repo, fetch)
    }
    #[deprecated(note = "use api::dev::git::start_branch instead")]
    pub fn start_branch(&self, repo: String, branch: String) -> DataObject {
        self::dev::git::start_branch(repo, branch)
    }
    #[deprecated(note = "use api::dev::git::update_from_master instead")]
    pub fn update_from_master(&self, repo: String, branch: String) -> DataObject {
        self::dev::git::update_from_master(repo, branch)
    }
    #[deprecated(note = "use api::dev::git::carry_branch instead")]
    pub fn carry_branch(&self, repo: String, branch: String) -> DataObject {
        self::dev::git::carry_branch(repo, branch)
    }
    #[deprecated(note = "use api::dev::git::untrack_generated instead")]
    pub fn untrack_generated(&self, repo: String, message: String) -> DataObject {
        self::dev::git::untrack_generated(repo, message)
    }
}
impl old_fillmore_fillmore {
    #[deprecated(note = "use api::fillmore::fillmore::authorize_store_download instead")]
    pub fn authorize_store_download(&self, pub_key: String, store_id: String) -> String {
        self::fillmore::fillmore::authorize_store_download(pub_key, store_id)
    }
    #[deprecated(note = "use api::fillmore::fillmore::authorize_store_upload instead")]
    pub fn authorize_store_upload(&self, pub_key: String) -> String {
        self::fillmore::fillmore::authorize_store_upload(pub_key)
    }
    #[deprecated(note = "use api::fillmore::fillmore::check_if_paused instead")]
    pub fn check_if_paused(&self) -> DataObject {
        self::fillmore::fillmore::check_if_paused()
    }
    #[deprecated(note = "use api::fillmore::fillmore::check_queue instead")]
    pub fn check_queue(&self, tasks: DataArray) -> DataObject {
        self::fillmore::fillmore::check_queue(tasks)
    }
    #[deprecated(note = "use api::fillmore::fillmore::do_synchronous instead")]
    pub fn do_synchronous(&self, job: DataObject, parentlog: DataArray) -> DataObject {
        self::fillmore::fillmore::do_synchronous(job, parentlog)
    }
    #[deprecated(note = "use api::fillmore::fillmore::gudrun_upload instead")]
    pub fn gudrun_upload(&self, jobid: String, file: String, fname: String) -> bool {
        self::fillmore::fillmore::gudrun_upload(jobid, file, fname)
    }
    #[deprecated(note = "use api::fillmore::fillmore::info instead")]
    pub fn info(&self) -> DataObject {
        self::fillmore::fillmore::info()
    }
    #[deprecated(note = "use api::fillmore::fillmore::init instead")]
    pub fn init(&self) -> DataObject {
        self::fillmore::fillmore::init()
    }
    #[deprecated(note = "use api::fillmore::fillmore::launch_ec2 instead")]
    pub fn launch_ec2(&self, data: DataObject) -> DataObject {
        self::fillmore::fillmore::launch_ec2(data)
    }
    #[deprecated(note = "use api::fillmore::fillmore::launch_runpod instead")]
    pub fn launch_runpod(&self, job: DataObject) -> DataObject {
        self::fillmore::fillmore::launch_runpod(job)
    }
    #[deprecated(note = "use api::fillmore::fillmore::oneshot_progress instead")]
    pub fn oneshot_progress(&self, data: DataObject) -> DataObject {
        self::fillmore::fillmore::oneshot_progress(data)
    }
    #[deprecated(note = "use api::fillmore::fillmore::oneshot_upload instead")]
    pub fn oneshot_upload(&self, jobid: String, filename: String, uuid: String, streamid: i64) -> bool {
        self::fillmore::fillmore::oneshot_upload(jobid, filename, uuid, streamid)
    }
    #[deprecated(note = "use api::fillmore::fillmore::pause instead")]
    pub fn pause(&self, pause: bool, allowone: bool) -> DataObject {
        self::fillmore::fillmore::pause(pause, allowone)
    }
    #[deprecated(note = "use api::fillmore::fillmore::prepare_dataset instead")]
    pub fn prepare_dataset(&self, job: DataObject) -> DataObject {
        self::fillmore::fillmore::prepare_dataset(job)
    }
    #[deprecated(note = "use api::fillmore::fillmore::raw instead")]
    pub fn raw(&self) -> DataObject {
        self::fillmore::fillmore::raw()
    }
    #[deprecated(note = "use api::fillmore::fillmore::rip instead")]
    pub fn rip(&self) -> i64 {
        self::fillmore::fillmore::rip()
    }
    #[deprecated(note = "use api::fillmore::fillmore::prune instead")]
    pub fn prune(&self) -> String {
        self::fillmore::fillmore::prune()
    }
}
impl old_fillmore_queue {
    #[deprecated(note = "use api::fillmore::queue::add_job instead")]
    pub fn add_job(&self, job: DataObject) -> bool {
        self::fillmore::queue::add_job(job)
    }
    #[deprecated(note = "use api::fillmore::queue::get_next instead")]
    pub fn get_next(&self, tasks: DataArray) -> DataObject {
        self::fillmore::queue::get_next(tasks)
    }
    #[deprecated(note = "use api::fillmore::queue::get_queue instead")]
    pub fn get_queue(&self, name: String, _do_not_use_: String) -> DataArray {
        self::fillmore::queue::get_queue(name, _do_not_use_)
    }
    #[deprecated(note = "use api::fillmore::queue::synchronous_job instead")]
    pub fn synchronous_job(&self, job: DataObject, parentlog: DataArray) -> DataObject {
        self::fillmore::queue::synchronous_job(job, parentlog)
    }
}
impl old_fillmore_jobs {
    #[deprecated(note = "use api::fillmore::jobs::launch_worker instead")]
    pub fn launch_worker(&self, job: DataObject) -> DataObject {
        self::fillmore::jobs::launch_worker(job)
    }
    #[deprecated(note = "use api::fillmore::jobs::merge_loras instead")]
    pub fn merge_loras(&self, job: DataObject) -> DataObject {
        self::fillmore::jobs::merge_loras(job)
    }
    #[deprecated(note = "use api::fillmore::jobs::video_to_lora instead")]
    pub fn video_to_lora(&self, job: DataObject) -> DataObject {
        self::fillmore::jobs::video_to_lora(job)
    }
    #[deprecated(note = "use api::fillmore::jobs::oneshot instead")]
    pub fn oneshot(&self, job: DataObject) -> DataObject {
        self::fillmore::jobs::oneshot(job)
    }
}
impl old_genmore_common {
    #[deprecated(note = "use api::genmore::common::add_info_to_png instead")]
    pub fn add_info_to_png(&self, png: String, info: DataObject) -> bool {
        self::genmore::common::add_info_to_png(png, info)
    }
    #[deprecated(note = "use api::genmore::common::build_archive instead")]
    pub fn build_archive(&self, job: DataObject) -> DataObject {
        self::genmore::common::build_archive(job)
    }
    #[deprecated(note = "use api::genmore::common::default_bad_tags instead")]
    pub fn default_bad_tags(&self) -> DataArray {
        self::genmore::common::default_bad_tags()
    }
    #[deprecated(note = "use api::genmore::common::download_checkpoint instead")]
    pub fn download_checkpoint(&self, checkpoint: String) -> String {
        self::genmore::common::download_checkpoint(checkpoint)
    }
    #[deprecated(note = "use api::genmore::common::download_lora instead")]
    pub fn download_lora(&self, lora_id: String, store_id: String) -> String {
        self::genmore::common::download_lora(lora_id, store_id)
    }
    #[deprecated(note = "use api::genmore::common::install_realesrgan instead")]
    pub fn install_realesrgan(&self) -> DataObject {
        self::genmore::common::install_realesrgan()
    }
    #[deprecated(note = "use api::genmore::common::parse_tags instead")]
    pub fn parse_tags(&self, tags: DataObject, bad_tags: DataArray) -> DataObject {
        self::genmore::common::parse_tags(tags, bad_tags)
    }
    #[deprecated(note = "use api::genmore::common::pg_bad_tags instead")]
    pub fn pg_bad_tags(&self) -> DataArray {
        self::genmore::common::pg_bad_tags()
    }
    #[deprecated(note = "use api::genmore::common::quantize instead")]
    pub fn quantize(&self, safetensors_path: String, gguf_path: String) -> bool {
        self::genmore::common::quantize(safetensors_path, gguf_path)
    }
    #[deprecated(note = "use api::genmore::common::read_lora_tags instead")]
    pub fn read_lora_tags(&self, lora: String) -> DataObject {
        self::genmore::common::read_lora_tags(lora)
    }
    #[deprecated(note = "use api::genmore::common::sha256sum instead")]
    pub fn sha256sum(&self, path: String) -> String {
        self::genmore::common::sha256sum(path)
    }
    #[deprecated(note = "use api::genmore::common::tags_to_prompt instead")]
    pub fn tags_to_prompt(&self, o: DataObject, trigger: String, gender: String, num_tags: i64, random: bool) -> String {
        self::genmore::common::tags_to_prompt(o, trigger, gender, num_tags, random)
    }
    #[deprecated(note = "use api::genmore::common::upscale instead")]
    pub fn upscale(&self, image: String, width: i64, height: i64) -> DataObject {
        self::genmore::common::upscale(image, width, height)
    }
    #[deprecated(note = "use api::genmore::common::upscale_dir instead")]
    pub fn upscale_dir(&self, job: DataObject) -> DataObject {
        self::genmore::common::upscale_dir(job)
    }
    #[deprecated(note = "use api::genmore::common::upscaler_compact instead")]
    pub fn upscaler_compact(&self) -> DataObject {
        self::genmore::common::upscaler_compact()
    }
    #[deprecated(note = "use api::genmore::common::upscaler_esrgan instead")]
    pub fn upscaler_esrgan(&self) -> DataObject {
        self::genmore::common::upscaler_esrgan()
    }
    #[deprecated(note = "use api::genmore::common::upscaler_realesrgan instead")]
    pub fn upscaler_realesrgan(&self) -> DataObject {
        self::genmore::common::upscaler_realesrgan()
    }
    #[deprecated(note = "use api::genmore::common::write_lora_tags instead")]
    pub fn write_lora_tags(&self, lora_path: String, tags: DataObject) -> DataObject {
        self::genmore::common::write_lora_tags(lora_path, tags)
    }
    #[deprecated(note = "use api::genmore::common::write_png_info instead")]
    pub fn write_png_info(&self, job: DataObject) -> DataObject {
        self::genmore::common::write_png_info(job)
    }
    #[deprecated(note = "use api::genmore::common::get_gpu_name instead")]
    pub fn get_gpu_name(&self) -> String {
        self::genmore::common::get_gpu_name()
    }
    #[deprecated(note = "use api::genmore::common::install_spandrel instead")]
    pub fn install_spandrel(&self) -> DataObject {
        self::genmore::common::install_spandrel()
    }
    #[deprecated(note = "use api::genmore::common::upscaler_spandrel instead")]
    pub fn upscaler_spandrel(&self, job: DataObject) -> DataObject {
        self::genmore::common::upscaler_spandrel(job)
    }
    #[deprecated(note = "use api::genmore::common::upscale_dir_spandrel instead")]
    pub fn upscale_dir_spandrel(&self, dir: String) -> DataObject {
        self::genmore::common::upscale_dir_spandrel(dir)
    }
}
impl old_genmore_ernie {
    #[deprecated(note = "use api::genmore::ernie::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::ernie::install()
    }
    #[deprecated(note = "use api::genmore::ernie::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::ernie::generate(job)
    }
}
impl old_genmore_flux {
    #[deprecated(note = "use api::genmore::flux::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::flux::generate(job)
    }
    #[deprecated(note = "use api::genmore::flux::generate_batch instead")]
    pub fn generate_batch(&self, job: DataObject) -> DataObject {
        self::genmore::flux::generate_batch(job)
    }
    #[deprecated(note = "use api::genmore::flux::generate_clip instead")]
    pub fn generate_clip(&self, jobid: String) -> bool {
        self::genmore::flux::generate_clip(jobid)
    }
    #[deprecated(note = "use api::genmore::flux::generate_flash_attn instead")]
    pub fn generate_flash_attn(&self) -> DataObject {
        self::genmore::flux::generate_flash_attn()
    }
    #[deprecated(note = "use api::genmore::flux::generate_latents instead")]
    pub fn generate_latents(&self, jobid: String, quantized: bool, width: i64, height: i64, cfg: f64, steps: i64, seed: i64) -> bool {
        self::genmore::flux::generate_latents(jobid, quantized, width, height, cfg, steps, seed)
    }
    #[deprecated(note = "use api::genmore::flux::generate_quantized instead")]
    pub fn generate_quantized(&self, job: DataObject) -> bool {
        self::genmore::flux::generate_quantized(job)
    }
    #[deprecated(note = "use api::genmore::flux::generate_t5 instead")]
    pub fn generate_t5(&self, jobid: String) -> bool {
        self::genmore::flux::generate_t5(jobid)
    }
    #[deprecated(note = "use api::genmore::flux::get_basemodel instead")]
    pub fn get_basemodel(&self) -> String {
        self::genmore::flux::get_basemodel()
    }
    #[deprecated(note = "use api::genmore::flux::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::flux::install()
    }
    #[deprecated(note = "use api::genmore::flux::install_klein instead")]
    pub fn install_klein(&self) -> DataObject {
        self::genmore::flux::install_klein()
    }
    #[deprecated(note = "use api::genmore::flux::merge instead")]
    pub fn merge(&self, job: DataObject) -> DataObject {
        self::genmore::flux::merge(job)
    }
    #[deprecated(note = "use api::genmore::flux::merge_to_basemodel instead")]
    pub fn merge_to_basemodel(&self, jobid: String, lora_ids: DataArray, lora_scales: DataArray) -> String {
        self::genmore::flux::merge_to_basemodel(jobid, lora_ids, lora_scales)
    }
    #[deprecated(note = "use api::genmore::flux::quantize_basemodel instead")]
    pub fn quantize_basemodel(&self, jobid: String) -> String {
        self::genmore::flux::quantize_basemodel(jobid)
    }
    #[deprecated(note = "use api::genmore::flux::render_latents instead")]
    pub fn render_latents(&self, jobid: String, width: i64, height: i64, cfg: f64, steps: i64, seed: i64) -> bool {
        self::genmore::flux::render_latents(jobid, width, height, cfg, steps, seed)
    }
    #[deprecated(note = "use api::genmore::flux::generate_klein instead")]
    pub fn generate_klein(&self, job: DataObject) -> DataObject {
        self::genmore::flux::generate_klein(job)
    }
}
impl old_genmore_genmore {
    #[deprecated(note = "use api::genmore::genmore::combine_loras instead")]
    pub fn combine_loras(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::combine_loras(job)
    }
    #[deprecated(note = "use api::genmore::genmore::dataset_to_nsfw_src_dataset instead")]
    pub fn dataset_to_nsfw_src_dataset(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::dataset_to_nsfw_src_dataset(job)
    }
    #[deprecated(note = "use api::genmore::genmore::generate_images instead")]
    pub fn generate_images(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::generate_images(job)
    }
    #[deprecated(note = "use api::genmore::genmore::generate_prompts instead")]
    pub fn generate_prompts(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::generate_prompts(job)
    }
    #[deprecated(note = "use api::genmore::genmore::lora_to_dataset instead")]
    pub fn lora_to_dataset(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::lora_to_dataset(job)
    }
    #[deprecated(note = "use api::genmore::genmore::install_promptgen instead")]
    pub fn install_promptgen(&self) -> DataObject {
        self::genmore::genmore::install_promptgen()
    }
    #[deprecated(note = "use api::genmore::genmore::make_dataset_nsfw instead")]
    pub fn make_dataset_nsfw(&self, job: DataObject) -> DataObject {
        self::genmore::genmore::make_dataset_nsfw(job)
    }
    #[deprecated(note = "use api::genmore::genmore::install_image_edit instead")]
    pub fn install_image_edit(&self) -> DataObject {
        self::genmore::genmore::install_image_edit()
    }
}
impl old_genmore_hunyuan {
    #[deprecated(note = "use api::genmore::hunyuan::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::hunyuan::install()
    }
    #[deprecated(note = "use api::genmore::hunyuan::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::hunyuan::generate(job)
    }
}
impl old_genmore_ideogram4 {
    #[deprecated(note = "use api::genmore::ideogram4::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::ideogram4::install()
    }
    #[deprecated(note = "use api::genmore::ideogram4::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::ideogram4::generate(job)
    }
}
impl old_genmore_llm {
    #[deprecated(note = "use api::genmore::llm::generate_text instead")]
    pub fn generate_text(&self, prompt: String) -> DataObject {
        self::genmore::llm::generate_text(prompt)
    }
    #[deprecated(note = "use api::genmore::llm::generate_text_sync instead")]
    pub fn generate_text_sync(&self, prompt: String) -> String {
        self::genmore::llm::generate_text_sync(prompt)
    }
    #[deprecated(note = "use api::genmore::llm::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::llm::install()
    }
    #[deprecated(note = "use api::genmore::llm::load instead")]
    pub fn load(&self) -> bool {
        self::genmore::llm::load()
    }
    #[deprecated(note = "use api::genmore::llm::unload instead")]
    pub fn unload(&self) -> DataObject {
        self::genmore::llm::unload()
    }
}
impl old_genmore_ltx2 {
    #[deprecated(note = "use api::genmore::ltx2::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::ltx2::install()
    }
    #[deprecated(note = "use api::genmore::ltx2::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::ltx2::generate(job)
    }
}
impl old_genmore_qweni {
    #[deprecated(note = "use api::genmore::qweni::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::qweni::install()
    }
    #[deprecated(note = "use api::genmore::qweni::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::qweni::generate(job)
    }
}
impl old_genmore_sdxl {
    #[deprecated(note = "use api::genmore::sdxl::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::sdxl::generate(job)
    }
    #[deprecated(note = "use api::genmore::sdxl::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::sdxl::install()
    }
    #[deprecated(note = "use api::genmore::sdxl::merge instead")]
    pub fn merge(&self, job: DataObject) -> DataObject {
        self::genmore::sdxl::merge(job)
    }
}
impl old_genmore_wan {
    #[deprecated(note = "use api::genmore::wan::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::wan::install()
    }
    #[deprecated(note = "use api::genmore::wan::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::wan::generate(job)
    }
}
impl old_genmore_wan22 {
    #[deprecated(note = "use api::genmore::wan22::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::wan22::install()
    }
    #[deprecated(note = "use api::genmore::wan22::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::wan22::generate(job)
    }
}
impl old_genmore_zimg {
    #[deprecated(note = "use api::genmore::zimg::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::zimg::generate(job)
    }
    #[deprecated(note = "use api::genmore::zimg::image_replace instead")]
    pub fn image_replace(&self, src_dir: String, dest_dir: String, work_dir: String, subject: String, to_replace: String, replace_with: String, color_source: String, log: DataArray) -> DataObject {
        self::genmore::zimg::image_replace(src_dir, dest_dir, work_dir, subject, to_replace, replace_with, color_source, log)
    }
    #[deprecated(note = "use api::genmore::zimg::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::zimg::install()
    }
    #[deprecated(note = "use api::genmore::zimg::install_image_replace instead")]
    pub fn install_image_replace(&self) -> DataObject {
        self::genmore::zimg::install_image_replace()
    }
    #[deprecated(note = "use api::genmore::zimg::face_swap instead")]
    pub fn face_swap(&self, src_dir: String, dest_dir: String, work_dir: String, target_person: String, lora_path: String, trigger_word: String, log: DataArray) -> DataObject {
        self::genmore::zimg::face_swap(src_dir, dest_dir, work_dir, target_person, lora_path, trigger_word, log)
    }
}
impl old_genmore_krea2 {
    #[deprecated(note = "use api::genmore::krea2::install instead")]
    pub fn install(&self) -> DataObject {
        self::genmore::krea2::install()
    }
    #[deprecated(note = "use api::genmore::krea2::generate instead")]
    pub fn generate(&self, job: DataObject) -> DataObject {
        self::genmore::krea2::generate(job)
    }
}
impl old_grabmore_grabmore {
    #[deprecated(note = "use api::grabmore::grabmore::crop_raw instead")]
    pub fn crop_raw(&self, workdir: String, threshold: f64, num_threads: i64, ref_img: Data) -> DataObject {
        self::grabmore::grabmore::crop_raw(workdir, threshold, num_threads, ref_img)
    }
    #[deprecated(note = "use api::grabmore::grabmore::download_from_store instead")]
    pub fn download_from_store(&self, dir: String, upload_ids: DataArray) -> String {
        self::grabmore::grabmore::download_from_store(dir, upload_ids)
    }
    #[deprecated(note = "use api::grabmore::grabmore::download_video instead")]
    pub fn download_video(&self, url: String, dir: String, max_downloads: i64, upload_ids: DataArray) -> DataObject {
        self::grabmore::grabmore::download_video(url, dir, max_downloads, upload_ids)
    }
    #[deprecated(note = "use api::grabmore::grabmore::extract_raw instead")]
    pub fn extract_raw(&self, workdir: String, fps: f64, num_threads: i64, clean: bool, target_count: i64) -> DataObject {
        self::grabmore::grabmore::extract_raw(workdir, fps, num_threads, clean, target_count)
    }
    #[deprecated(note = "use api::grabmore::grabmore::init instead")]
    pub fn init(&self) -> DataObject {
        self::grabmore::grabmore::init()
    }
    #[deprecated(note = "use api::grabmore::grabmore::instagram_to_dataset instead")]
    pub fn instagram_to_dataset(&self, channel: String, count: i64, crop: bool, tag: bool, trigger: String) -> String {
        self::grabmore::grabmore::instagram_to_dataset(channel, count, crop, tag, trigger)
    }
    #[deprecated(note = "use api::grabmore::grabmore::media_info instead")]
    pub fn media_info(&self, filename: String) -> DataObject {
        self::grabmore::grabmore::media_info(filename)
    }
    #[deprecated(note = "use api::grabmore::grabmore::python_require instead")]
    pub fn python_require(&self, requirements: DataArray) -> String {
        self::grabmore::grabmore::python_require(requirements)
    }
    #[deprecated(note = "use api::grabmore::grabmore::url_to_dataset instead")]
    pub fn url_to_dataset(&self, url: String, trigger: String, crop: bool, tag: bool, upload_ids: DataArray) -> String {
        self::grabmore::grabmore::url_to_dataset(url, trigger, crop, tag, upload_ids)
    }
    #[deprecated(note = "use api::grabmore::grabmore::oneshot_data instead")]
    pub fn oneshot_data(&self, job: DataObject) -> DataObject {
        self::grabmore::grabmore::oneshot_data(job)
    }
}
impl old_grabmore_imageproc {
    #[deprecated(note = "use api::grabmore::imageproc::crop_and_sort instead")]
    pub fn crop_and_sort(&self) -> DataObject {
        self::grabmore::imageproc::crop_and_sort()
    }
    #[deprecated(note = "use api::grabmore::imageproc::prepare_dataset instead")]
    pub fn prepare_dataset(&self, workdir: String, num_steps: i64) -> DataObject {
        self::grabmore::imageproc::prepare_dataset(workdir, num_steps)
    }
}
impl old_grabmore_selenium {
    #[deprecated(note = "use api::grabmore::selenium::install instead")]
    pub fn install(&self) -> String {
        self::grabmore::selenium::install()
    }
}
impl old_grabmore_tag {
    #[deprecated(note = "use api::grabmore::tag::install_tag instead")]
    pub fn install_tag(&self) -> DataObject {
        self::grabmore::tag::install_tag()
    }
    #[deprecated(note = "use api::grabmore::tag::tag instead")]
    pub fn tag(&self, dir: String, trigger: String) -> DataObject {
        self::grabmore::tag::tag(dir, trigger)
    }
    #[deprecated(note = "use api::grabmore::tag::load_dataset_tags instead")]
    pub fn load_dataset_tags(&self, dir: String) -> DataObject {
        self::grabmore::tag::load_dataset_tags(dir)
    }
}
impl old_grabmore_tasks {
    #[deprecated(note = "use api::grabmore::tasks::build_dataset instead")]
    pub fn build_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::build_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::build_src_dataset instead")]
    pub fn build_src_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::build_src_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::clean instead")]
    pub fn clean(&self, job: DataObject) -> bool {
        self::grabmore::tasks::clean(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::crop instead")]
    pub fn crop(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::crop(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::download instead")]
    pub fn download(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::download(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::download_from_instagram instead")]
    pub fn download_from_instagram(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::download_from_instagram(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::download_from_instagram_with_selenium instead")]
    pub fn download_from_instagram_with_selenium(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::download_from_instagram_with_selenium(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::download_from_store instead")]
    pub fn download_from_store(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::download_from_store(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::download_from_url instead")]
    pub fn download_from_url(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::download_from_url(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::extract instead")]
    pub fn extract(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::extract(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::instagram_to_dataset instead")]
    pub fn instagram_to_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::instagram_to_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::instagram_to_dataset_with_selenium instead")]
    pub fn instagram_to_dataset_with_selenium(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::instagram_to_dataset_with_selenium(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::instagram_to_src_dataset instead")]
    pub fn instagram_to_src_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::instagram_to_src_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::instagram_to_src_dataset_with_selenium instead")]
    pub fn instagram_to_src_dataset_with_selenium(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::instagram_to_src_dataset_with_selenium(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::media_to_dataset instead")]
    pub fn media_to_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::media_to_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::media_to_src_dataset instead")]
    pub fn media_to_src_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::media_to_src_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::src_dataset_to_dataset instead")]
    pub fn src_dataset_to_dataset(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::src_dataset_to_dataset(job)
    }
    #[deprecated(note = "use api::grabmore::tasks::tag instead")]
    pub fn tag(&self, job: DataObject) -> DataObject {
        self::grabmore::tasks::tag(job)
    }
}
impl old_grabmore_videoproc {
    #[deprecated(note = "use api::grabmore::videoproc::extract_all_frames instead")]
    pub fn extract_all_frames(&self, video_files: DataArray, frames_root: String, fps: f64) -> bool {
        self::grabmore::videoproc::extract_all_frames(video_files, frames_root, fps)
    }
    #[deprecated(note = "use api::grabmore::videoproc::extract_raw_frames instead")]
    pub fn extract_raw_frames(&self, video_files: DataArray, frames_dir: String, output_dir: String, fps: f64, target_image_count: i64) -> String {
        self::grabmore::videoproc::extract_raw_frames(video_files, frames_dir, output_dir, fps, target_image_count)
    }
    #[deprecated(note = "use api::grabmore::videoproc::extract_segments instead")]
    pub fn extract_segments(&self, video_files: DataArray, ref_img_path: String, output_dir: String, frames_dir: String, fps: f64, max_total_duration: f64, max_clip: f64, is_strict: bool) -> DataArray {
        self::grabmore::videoproc::extract_segments(video_files, ref_img_path, output_dir, frames_dir, fps, max_total_duration, max_clip, is_strict)
    }
    #[deprecated(note = "use api::grabmore::videoproc::generate_auto_reference instead")]
    pub fn generate_auto_reference(&self, frames_dir: String, root: String, input_ref: Data) -> String {
        self::grabmore::videoproc::generate_auto_reference(frames_dir, root, input_ref)
    }
    #[deprecated(note = "use api::grabmore::videoproc::prepare_source_video instead")]
    pub fn prepare_source_video(&self, job: DataObject) -> DataObject {
        self::grabmore::videoproc::prepare_source_video(job)
    }
}
impl old_gudrun_admin {
    #[deprecated(note = "use api::gudrun::admin::list_jobs instead")]
    pub fn list_jobs(&self, include_done: bool) -> DataArray {
        self::gudrun::admin::list_jobs(include_done)
    }
    #[deprecated(note = "use api::gudrun::admin::make_job_done instead")]
    pub fn make_job_done(&self, jobid: String) -> String {
        self::gudrun::admin::make_job_done(jobid)
    }
    #[deprecated(note = "use api::gudrun::admin::read_last_3_days_job_data instead")]
    pub fn read_last_3_days_job_data(&self) -> DataArray {
        self::gudrun::admin::read_last_3_days_job_data()
    }
    #[deprecated(note = "use api::gudrun::admin::refund_job instead")]
    pub fn refund_job(&self, job: DataObject) -> String {
        self::gudrun::admin::refund_job(job)
    }
    #[deprecated(note = "use api::gudrun::admin::resubmit instead")]
    pub fn resubmit(&self, job: DataObject) -> DataObject {
        self::gudrun::admin::resubmit(job)
    }
    #[deprecated(note = "use api::gudrun::admin::set_job_error instead")]
    pub fn set_job_error(&self, jobid: String, errorcode: String) -> String {
        self::gudrun::admin::set_job_error(jobid, errorcode)
    }
    #[deprecated(note = "use api::gudrun::admin::update_job instead")]
    pub fn update_job(&self, job: DataObject) -> DataObject {
        self::gudrun::admin::update_job(job)
    }
}
impl old_gudrun_contact {
    #[deprecated(note = "use api::gudrun::contact::dm instead")]
    pub fn dm(&self, msg: DataObject, nn_sessionid: String) -> String {
        self::gudrun::contact::dm(msg, nn_sessionid)
    }
}
impl old_gudrun_dataset {
    #[deprecated(note = "use api::gudrun::dataset::thumbnails instead")]
    pub fn thumbnails(&self, id: String) -> String {
        self::gudrun::dataset::thumbnails(id)
    }
}
impl old_gudrun_file_upload {
    #[deprecated(note = "use api::gudrun::file_upload::is_upload_done instead")]
    pub fn is_upload_done(&self, uid: String) -> bool {
        self::gudrun::file_upload::is_upload_done(uid)
    }
    #[deprecated(note = "use api::gudrun::file_upload::start_upload instead")]
    pub fn start_upload(&self, filename: String, filesize: i64, nn_sessionid: String) -> String {
        self::gudrun::file_upload::start_upload(filename, filesize, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::file_upload::upload_chunk instead")]
    pub fn upload_chunk(&self, upload_id: String, chunk_index: i64, chunk_data: String) -> String {
        self::gudrun::file_upload::upload_chunk(upload_id, chunk_index, chunk_data)
    }
}
impl old_gudrun_gudrun {
    #[deprecated(note = "use api::gudrun::gudrun::attach instead")]
    pub fn attach(&self, jobid: String, filename: String, uuid: String, streamid: i64) -> bool {
        self::gudrun::gudrun::attach(jobid, filename, uuid, streamid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::balance instead")]
    pub fn balance(&self, nn_sessionid: String) -> i64 {
        self::gudrun::gudrun::balance(nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::calculate_price instead")]
    pub fn calculate_price(&self, job: DataObject) -> i64 {
        self::gudrun::gudrun::calculate_price(job)
    }
    #[deprecated(note = "use api::gudrun::gudrun::dataset_thumbnails instead")]
    pub fn dataset_thumbnails(&self, id: String) -> String {
        self::gudrun::gudrun::dataset_thumbnails(id)
    }
    #[deprecated(note = "use api::gudrun::gudrun::deletemyaccount instead")]
    pub fn deletemyaccount(&self, nn_sessionid: String) -> String {
        self::gudrun::gudrun::deletemyaccount(nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::download instead")]
    pub fn download(&self, storeid: String, jobid: String, extension: String) -> String {
        self::gudrun::gudrun::download(storeid, jobid, extension)
    }
    #[deprecated(note = "use api::gudrun::gudrun::finish instead")]
    pub fn finish(&self, id: String, tk: String, data: DataObject) -> String {
        self::gudrun::gudrun::finish(id, tk, data)
    }
    #[deprecated(note = "use api::gudrun::gudrun::hold instead")]
    pub fn hold(&self, id: String, nn_sessionid: String) -> String {
        self::gudrun::gudrun::hold(id, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::init instead")]
    pub fn init(&self) -> DataObject {
        self::gudrun::gudrun::init()
    }
    #[deprecated(note = "use api::gudrun::gudrun::job instead")]
    pub fn job(&self, permalink: String, jobid: String) -> DataObject {
        self::gudrun::gudrun::job(permalink, jobid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::jobs instead")]
    pub fn jobs(&self, permalink: String) -> DataObject {
        self::gudrun::gudrun::jobs(permalink)
    }
    #[deprecated(note = "use api::gudrun::gudrun::join instead")]
    pub fn join(&self, nn_sessionid: String) -> String {
        self::gudrun::gudrun::join(nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::loras instead")]
    pub fn loras(&self, nn_sessionid: String) -> DataArray {
        self::gudrun::gudrun::loras(nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::permalink instead")]
    pub fn permalink(&self, nn_path: String, nn_sessionid: String) -> String {
        self::gudrun::gudrun::permalink(nn_path, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::progress instead")]
    pub fn progress(&self, id: String, tk: String, data: DataObject) -> String {
        self::gudrun::gudrun::progress(id, tk, data)
    }
    #[deprecated(note = "use api::gudrun::gudrun::rebuild_index instead")]
    pub fn rebuild_index(&self) -> DataObject {
        self::gudrun::gudrun::rebuild_index()
    }
    #[deprecated(note = "use api::gudrun::gudrun::register instead")]
    pub fn register(&self, uuid: String, pubkey: String) -> DataObject {
        self::gudrun::gudrun::register(uuid, pubkey)
    }
    #[deprecated(note = "use api::gudrun::gudrun::resubmit instead")]
    pub fn resubmit(&self, job: DataObject) -> DataObject {
        self::gudrun::gudrun::resubmit(job)
    }
    #[deprecated(note = "use api::gudrun::gudrun::status instead")]
    pub fn status(&self, nn_sessionid: String, permalink: String) -> DataObject {
        self::gudrun::gudrun::status(nn_sessionid, permalink)
    }
    #[deprecated(note = "use api::gudrun::gudrun::submit instead")]
    pub fn submit(&self, job: DataObject, nn_sessionid: String) -> DataObject {
        self::gudrun::gudrun::submit(job, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::task instead")]
    pub fn task(&self, id: String, tk: String) -> DataObject {
        self::gudrun::gudrun::task(id, tk)
    }
    #[deprecated(note = "use api::gudrun::gudrun::withdraw instead")]
    pub fn withdraw(&self, amt: i64, nn_sessionid: String) -> String {
        self::gudrun::gudrun::withdraw(amt, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::dataset_files instead")]
    pub fn dataset_files(&self, id: String) -> String {
        self::gudrun::gudrun::dataset_files(id)
    }
    #[deprecated(note = "use api::gudrun::gudrun::dataset_update instead")]
    pub fn dataset_update(&self, payload: DataObject, nn_sessionid: String) -> DataObject {
        self::gudrun::gudrun::dataset_update(payload, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::gudrun::dataset_captions instead")]
    pub fn dataset_captions(&self, jobid: String, nn_sessionid: String) -> DataObject {
        self::gudrun::gudrun::dataset_captions(jobid, nn_sessionid)
    }
}
impl old_gudrun_job {
    #[deprecated(note = "use api::gudrun::job::accept_result_file instead")]
    pub fn accept_result_file(&self, jobid: String, streamid: i64) -> String {
        self::gudrun::job::accept_result_file(jobid, streamid)
    }
    #[deprecated(note = "use api::gudrun::job::delete_job instead")]
    pub fn delete_job(&self, jobid: String, nn_sessionid: String) -> bool {
        self::gudrun::job::delete_job(jobid, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::job::info instead")]
    pub fn info(&self, jobid: String, nn_sessionid: String) -> DataObject {
        self::gudrun::job::info(jobid, nn_sessionid)
    }
    #[deprecated(note = "use api::gudrun::job::lookup_storeid instead")]
    pub fn lookup_storeid(&self, jobid: String) -> String {
        self::gudrun::job::lookup_storeid(jobid)
    }
    #[deprecated(note = "use api::gudrun::job::lookup_trigger instead")]
    pub fn lookup_trigger(&self, jobid: String) -> String {
        self::gudrun::job::lookup_trigger(jobid)
    }
    #[deprecated(note = "use api::gudrun::job::update_job instead")]
    pub fn update_job(&self, job: DataObject) -> DataObject {
        self::gudrun::job::update_job(job)
    }
}
impl old_gudrun_jobs {
    #[deprecated(note = "use api::gudrun::jobs::list_jobs instead")]
    pub fn list_jobs(&self, nn_sessionid: String) -> DataObject {
        self::gudrun::jobs::list_jobs(nn_sessionid)
    }
}
impl old_gudrun_list_sessions {
    #[deprecated(note = "use api::gudrun::list_sessions::list_users instead")]
    pub fn list_users(&self) -> DataArray {
        self::gudrun::list_sessions::list_users()
    }
    #[deprecated(note = "use api::gudrun::list_sessions::unload_users instead")]
    pub fn unload_users(&self) -> String {
        self::gudrun::list_sessions::unload_users()
    }
    #[deprecated(note = "use api::gudrun::list_sessions::calculate_job_duration_stats instead")]
    pub fn calculate_job_duration_stats(&self, job_type: String, basemodel: String) -> DataObject {
        self::gudrun::list_sessions::calculate_job_duration_stats(job_type, basemodel)
    }
}
impl old_gudrun_log {
    #[deprecated(note = "use api::gudrun::log::log_http_begin instead")]
    pub fn log_http_begin(&self, timestamp: i64, loc: String, method: String, host: String, path: String, querystring: String, referer: String) -> String {
        self::gudrun::log::log_http_begin(timestamp, loc, method, host, path, querystring, referer)
    }
    #[deprecated(note = "use api::gudrun::log::query_http_logs instead")]
    pub fn query_http_logs(&self, start_ts: i64, end_ts: i64, group_by: String) -> DataObject {
        self::gudrun::log::query_http_logs(start_ts, end_ts, group_by)
    }
}
impl old_gudrun_lora_to_image {
    #[deprecated(note = "use api::gudrun::lora_to_image::load_lora_tags instead")]
    pub fn load_lora_tags(&self, storeid: String) -> DataObject {
        self::gudrun::lora_to_image::load_lora_tags(storeid)
    }
    #[deprecated(note = "use api::gudrun::lora_to_image::submit instead")]
    pub fn submit(&self, job: DataObject, nn_sessionid: String) -> DataObject {
        self::gudrun::lora_to_image::submit(job, nn_sessionid)
    }
}
impl old_gudrun_promo {
    #[deprecated(note = "use api::gudrun::promo::get_promo_list instead")]
    pub fn get_promo_list(&self) -> DataArray {
        self::gudrun::promo::get_promo_list()
    }
    #[deprecated(note = "use api::gudrun::promo::submit_promo instead")]
    pub fn submit_promo(&self, lora_id: String, url: String, displayname: String, nn_sessionid: String) -> String {
        self::gudrun::promo::submit_promo(lora_id, url, displayname, nn_sessionid)
    }
}
impl old_gudrun_promo_admin {
    #[deprecated(note = "use api::gudrun::promo_admin::approve_submission instead")]
    pub fn approve_submission(&self, submission_id: String, img_url: String) -> String {
        self::gudrun::promo_admin::approve_submission(submission_id, img_url)
    }
    #[deprecated(note = "use api::gudrun::promo_admin::decline_submission instead")]
    pub fn decline_submission(&self, submission_id: String) -> String {
        self::gudrun::promo_admin::decline_submission(submission_id)
    }
    #[deprecated(note = "use api::gudrun::promo_admin::download_promo_images instead")]
    pub fn download_promo_images(&self) -> DataObject {
        self::gudrun::promo_admin::download_promo_images()
    }
    #[deprecated(note = "use api::gudrun::promo_admin::set_submission_image_url instead")]
    pub fn set_submission_image_url(&self, submission_id: String, img_url: String) -> String {
        self::gudrun::promo_admin::set_submission_image_url(submission_id, img_url)
    }
}
impl old_gudrun_social {
    #[deprecated(note = "use api::gudrun::social::build_model_csv instead")]
    pub fn build_model_csv(&self) -> String {
        self::gudrun::social::build_model_csv()
    }
    #[deprecated(note = "use api::gudrun::social::build_model_index instead")]
    pub fn build_model_index(&self) -> DataObject {
        self::gudrun::social::build_model_index()
    }
    #[deprecated(note = "use api::gudrun::social::fetch_all_images instead")]
    pub fn fetch_all_images(&self) -> DataObject {
        self::gudrun::social::fetch_all_images()
    }
    #[deprecated(note = "use api::gudrun::social::fetch_model_data instead")]
    pub fn fetch_model_data(&self) -> DataArray {
        self::gudrun::social::fetch_model_data()
    }
    #[deprecated(note = "use api::gudrun::social::list instead")]
    pub fn list(&self) -> DataArray {
        self::gudrun::social::list()
    }
    #[deprecated(note = "use api::gudrun::social::list_featured instead")]
    pub fn list_featured(&self) -> DataArray {
        self::gudrun::social::list_featured()
    }
    #[deprecated(note = "use api::gudrun::social::list_model_images instead")]
    pub fn list_model_images(&self, version_id: String) -> DataArray {
        self::gudrun::social::list_model_images(version_id)
    }
    #[deprecated(note = "use api::gudrun::social::list_models instead")]
    pub fn list_models(&self) -> DataArray {
        self::gudrun::social::list_models()
    }
    #[deprecated(note = "use api::gudrun::social::list_models_with_stats instead")]
    pub fn list_models_with_stats(&self) -> DataArray {
        self::gudrun::social::list_models_with_stats()
    }
    #[deprecated(note = "use api::gudrun::social::set_featured instead")]
    pub fn set_featured(&self, modelid: String, featured: bool) -> String {
        self::gudrun::social::set_featured(modelid, featured)
    }
}
impl old_gudrun_stats {
    #[deprecated(note = "use api::gudrun::stats::jobs instead")]
    pub fn jobs(&self, start: i64, end: i64, exclude: DataArray) -> DataArray {
        self::gudrun::stats::jobs(start, end, exclude)
    }
    #[deprecated(note = "use api::gudrun::stats::pageloads instead")]
    pub fn pageloads(&self, start: i64, end: i64, step: i64) -> DataArray {
        self::gudrun::stats::pageloads(start, end, step)
    }
    #[deprecated(note = "use api::gudrun::stats::permalinks instead")]
    pub fn permalinks(&self) -> DataArray {
        self::gudrun::stats::permalinks()
    }
    #[deprecated(note = "use api::gudrun::stats::safetensors instead")]
    pub fn safetensors(&self) -> DataArray {
        self::gudrun::stats::safetensors()
    }
    #[deprecated(note = "use api::gudrun::stats::sales instead")]
    pub fn sales(&self, start: i64, end: i64, step: i64) -> DataArray {
        self::gudrun::stats::sales(start, end, step)
    }
    #[deprecated(note = "use api::gudrun::stats::users instead")]
    pub fn users(&self, start: i64, end: i64) -> DataArray {
        self::gudrun::stats::users(start, end)
    }
}
impl old_gudrun_tip {
    #[deprecated(note = "use api::gudrun::tip::prepare_tip instead")]
    pub fn prepare_tip(&self, jarid: String, tip: String) -> String {
        self::gudrun::tip::prepare_tip(jarid, tip)
    }
    #[deprecated(note = "use api::gudrun::tip::tip instead")]
    pub fn tip(&self, txcu: String, tipid: String) -> String {
        self::gudrun::tip::tip(txcu, tipid)
    }
}
impl old_gudrun_tokens {
    #[deprecated(note = "use api::gudrun::tokens::my_tipjar_id instead")]
    pub fn my_tipjar_id(&self, nn_sessionid: String) -> String {
        self::gudrun::tokens::my_tipjar_id(nn_sessionid)
    }
}
impl old_hagarmap_hagarmap {
    #[deprecated(note = "use api::hagarmap::hagarmap::fetch_layers instead")]
    pub fn fetch_layers(&self) -> DataObject {
        self::hagarmap::hagarmap::fetch_layers()
    }
}
impl old_minifig_minifig {
    #[deprecated(note = "use api::minifig::minifig::check_for_job instead")]
    pub fn check_for_job(&self, uuid: String, tasks: DataArray) -> DataObject {
        self::minifig::minifig::check_for_job(uuid, tasks)
    }
    #[deprecated(note = "use api::minifig::minifig::composite_job instead")]
    pub fn composite_job(&self, job: DataObject) -> DataObject {
        self::minifig::minifig::composite_job(job)
    }
    #[deprecated(note = "use api::minifig::minifig::download_from_store instead")]
    pub fn download_from_store(&self, store_id: String, file_path: String) -> bool {
        self::minifig::minifig::download_from_store(store_id, file_path)
    }
    #[deprecated(note = "use api::minifig::minifig::get_stats instead")]
    pub fn get_stats(&self) -> DataObject {
        self::minifig::minifig::get_stats()
    }
    #[deprecated(note = "use api::minifig::minifig::init instead")]
    pub fn init(&self) -> DataObject {
        self::minifig::minifig::init()
    }
    #[deprecated(note = "use api::minifig::minifig::job instead")]
    pub fn job(&self, data: DataObject) -> DataObject {
        self::minifig::minifig::job(data)
    }
    #[deprecated(note = "use api::minifig::minifig::unlock instead")]
    pub fn unlock(&self) -> DataObject {
        self::minifig::minifig::unlock()
    }
    #[deprecated(note = "use api::minifig::minifig::upload_to_store instead")]
    pub fn upload_to_store(&self, file_path: String) -> String {
        self::minifig::minifig::upload_to_store(file_path)
    }
    #[deprecated(note = "use api::minifig::minifig::set_polling instead")]
    pub fn set_polling(&self, polling: bool) -> String {
        self::minifig::minifig::set_polling(polling)
    }
}
impl old_nebula_nebula {
    #[deprecated(note = "use api::nebula::nebula::add_member instead")]
    pub fn add_member(&self, servicename: String, peer: String, ipaddress: String, groups: String) -> DataObject {
        self::nebula::nebula::add_member(servicename, peer, ipaddress, groups)
    }
    #[deprecated(note = "use api::nebula::nebula::build_config instead")]
    pub fn build_config(&self, servicename: String) -> String {
        self::nebula::nebula::build_config(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::create_network instead")]
    pub fn create_network(&self, name: String, subnet: String, port: String) -> DataObject {
        self::nebula::nebula::create_network(name, subnet, port)
    }
    #[deprecated(note = "use api::nebula::nebula::info instead")]
    pub fn info(&self) -> DataObject {
        self::nebula::nebula::info()
    }
    #[deprecated(note = "use api::nebula::nebula::init instead")]
    pub fn init(&self) -> DataObject {
        self::nebula::nebula::init()
    }
    #[deprecated(note = "use api::nebula::nebula::install_release instead")]
    pub fn install_release(&self, url: String, version: String) -> String {
        self::nebula::nebula::install_release(url, version)
    }
    #[deprecated(note = "use api::nebula::nebula::install_service instead")]
    pub fn install_service(&self, servicename: String) -> String {
        self::nebula::nebula::install_service(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::join_network instead")]
    pub fn join_network(&self, servicename: String, subnet: String, ipaddress: String, port: String, owner: String, ca_crt: String, host_crt: String, host_key: String, lighthouses: DataObject, groups: String) -> DataObject {
        self::nebula::nebula::join_network(servicename, subnet, ipaddress, port, owner, ca_crt, host_crt, host_key, lighthouses, groups)
    }
    #[deprecated(note = "use api::nebula::nebula::members instead")]
    pub fn members(&self, servicename: String) -> DataObject {
        self::nebula::nebula::members(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::restart_service instead")]
    pub fn restart_service(&self, servicename: String) -> String {
        self::nebula::nebula::restart_service(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::save_config instead")]
    pub fn save_config(&self, servicename: String, config: DataObject) -> DataObject {
        self::nebula::nebula::save_config(servicename, config)
    }
    #[deprecated(note = "use api::nebula::nebula::start instead")]
    pub fn start(&self, servicename: String) -> DataObject {
        self::nebula::nebula::start(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::start_service instead")]
    pub fn start_service(&self, servicename: String) -> String {
        self::nebula::nebula::start_service(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::stop_service instead")]
    pub fn stop_service(&self, servicename: String) -> String {
        self::nebula::nebula::stop_service(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::uninstall_service instead")]
    pub fn uninstall_service(&self, servicename: String) -> String {
        self::nebula::nebula::uninstall_service(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::remove_member instead")]
    pub fn remove_member(&self, servicename: String, peer: String) -> String {
        self::nebula::nebula::remove_member(servicename, peer)
    }
    #[deprecated(note = "use api::nebula::nebula::stop instead")]
    pub fn stop(&self, servicename: String) -> DataObject {
        self::nebula::nebula::stop(servicename)
    }
    #[deprecated(note = "use api::nebula::nebula::set_boot instead")]
    pub fn set_boot(&self, servicename: String, enabled: bool) -> DataObject {
        self::nebula::nebula::set_boot(servicename, enabled)
    }
    #[deprecated(note = "use api::nebula::nebula::releases instead")]
    pub fn releases(&self) -> DataObject {
        self::nebula::nebula::releases()
    }
    #[deprecated(note = "use api::nebula::nebula::endpoints instead")]
    pub fn endpoints(&self, servicename: String, observe: String) -> DataObject {
        self::nebula::nebula::endpoints(servicename, observe)
    }
    #[deprecated(note = "use api::nebula::nebula::update_hosts instead")]
    pub fn update_hosts(&self, servicename: String, hosts: DataObject) -> DataObject {
        self::nebula::nebula::update_hosts(servicename, hosts)
    }
}
impl old_peer_peer {
    #[deprecated(note = "use api::peer::peer::discovery instead")]
    pub fn discovery(&self) -> DataObject {
        self::peer::peer::discovery()
    }
    #[deprecated(note = "use api::peer::peer::info instead")]
    pub fn info(&self, nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
        self::peer::peer::info(nn_sessionid, uuid, salt)
    }
    #[deprecated(note = "use api::peer::peer::local instead")]
    pub fn local(&self, request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
        self::peer::peer::local(request, nn_session, nn_sessionid)
    }
    #[deprecated(note = "use api::peer::peer::peers instead")]
    pub fn peers(&self) -> DataArray {
        self::peer::peer::peers()
    }
    #[deprecated(note = "use api::peer::peer::remote instead")]
    pub fn remote(&self, nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
        self::peer::peer::remote(nn_path, nn_params, nn_headers)
    }
}
impl old_peer_reboot {
    #[deprecated(note = "use api::peer::reboot::init instead")]
    pub fn init(&self) -> DataObject {
        self::peer::reboot::init()
    }
    #[deprecated(note = "use api::peer::reboot::reboot instead")]
    pub fn reboot(&self) -> DataObject {
        self::peer::reboot::reboot()
    }
}
impl old_peer_service {
    #[deprecated(note = "use api::peer::service::close_stream instead")]
    pub fn close_stream(&self, uuid: String, streamid: i64, write: bool) -> DataObject {
        self::peer::service::close_stream(uuid, streamid, write)
    }
    #[deprecated(note = "use api::peer::service::discovery instead")]
    pub fn discovery(&self) -> String {
        self::peer::service::discovery()
    }
    #[deprecated(note = "use api::peer::service::exec instead")]
    pub fn exec(&self, uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
        self::peer::service::exec(uuid, app, cmd, params)
    }
    #[deprecated(note = "use api::peer::service::get_stream instead")]
    pub fn get_stream(&self, uuid: String, stream_id: i64) -> DataBytes {
        self::peer::service::get_stream(uuid, stream_id)
    }
    #[deprecated(note = "use api::peer::service::init instead")]
    pub fn init(&self) -> DataObject {
        self::peer::service::init()
    }
    #[deprecated(note = "use api::peer::service::listen instead")]
    pub fn listen(&self, ipaddr: String, port: i64) -> i64 {
        self::peer::service::listen(ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::listen_udp instead")]
    pub fn listen_udp(&self, ipaddr: String, port: i64) -> i64 {
        self::peer::service::listen_udp(ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::maintenance instead")]
    pub fn maintenance(&self) -> String {
        self::peer::service::maintenance()
    }
    #[deprecated(note = "use api::peer::service::new_stream instead")]
    pub fn new_stream(&self, uuid: String) -> i64 {
        self::peer::service::new_stream(uuid)
    }
    #[deprecated(note = "use api::peer::service::session_expire instead")]
    pub fn session_expire(&self, user: DataObject) -> DataObject {
        self::peer::service::session_expire(user)
    }
    #[deprecated(note = "use api::peer::service::stream_write instead")]
    pub fn stream_write(&self, uuid: String, stream_id: i64, data: DataBytes) -> bool {
        self::peer::service::stream_write(uuid, stream_id, data)
    }
    #[deprecated(note = "use api::peer::service::tcp_connect instead")]
    pub fn tcp_connect(&self, uuid: String, ipaddr: String, port: i64) -> bool {
        self::peer::service::tcp_connect(uuid, ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::udp_connect instead")]
    pub fn udp_connect(&self, ipaddr: String, port: i64) -> DataObject {
        self::peer::service::udp_connect(ipaddr, port)
    }
}
impl old_security_security {
    #[deprecated(note = "use api::security::security::current_user instead")]
    pub fn current_user(&self, nn_sessionid: String) -> DataObject {
        self::security::security::current_user(nn_sessionid)
    }
    #[deprecated(note = "use api::security::security::deleteuser instead")]
    pub fn deleteuser(&self, id: String) -> String {
        self::security::security::deleteuser(id)
    }
    #[deprecated(note = "use api::security::security::groups instead")]
    pub fn groups(&self) -> DataArray {
        self::security::security::groups()
    }
    #[deprecated(note = "use api::security::security::init instead")]
    pub fn init(&self) -> DataObject {
        self::security::security::init()
    }
    #[deprecated(note = "use api::security::security::setuser instead")]
    pub fn setuser(&self, id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
        self::security::security::setuser(id, displayname, password, groups, keepalive, address, port)
    }
    #[deprecated(note = "use api::security::security::users instead")]
    pub fn users(&self) -> DataObject {
        self::security::security::users()
    }
}
impl old_storage_storage {
    #[deprecated(note = "use api::storage::storage::authorize_download instead")]
    pub fn authorize_download(&self, pub_key: String, store_id: String) -> String {
        self::storage::storage::authorize_download(pub_key, store_id)
    }
    #[deprecated(note = "use api::storage::storage::authorize_upload instead")]
    pub fn authorize_upload(&self, pub_key: String) -> String {
        self::storage::storage::authorize_upload(pub_key)
    }
    #[deprecated(note = "use api::storage::storage::fetch instead")]
    pub fn fetch(&self, storeid: String, nn_sessionid: String) -> DataObject {
        self::storage::storage::fetch(storeid, nn_sessionid)
    }
    #[deprecated(note = "use api::storage::storage::get instead")]
    pub fn get(&self, uuid: String, storeid: String) -> String {
        self::storage::storage::get(uuid, storeid)
    }
    #[deprecated(note = "use api::storage::storage::init instead")]
    pub fn init(&self) -> DataObject {
        self::storage::storage::init()
    }
    #[deprecated(note = "use api::storage::storage::nfs_mount instead")]
    pub fn nfs_mount(&self, remote: String) -> DataObject {
        self::storage::storage::nfs_mount(remote)
    }
    #[deprecated(note = "use api::storage::storage::nfs_save instead")]
    pub fn nfs_save(&self) -> DataObject {
        self::storage::storage::nfs_save()
    }
    #[deprecated(note = "use api::storage::storage::put instead")]
    pub fn put(&self, uuid: String, path: String) -> String {
        self::storage::storage::put(uuid, path)
    }
    #[deprecated(note = "use api::storage::storage::store instead")]
    pub fn store(&self, len: i64, nn_sessionid: String) -> DataObject {
        self::storage::storage::store(len, nn_sessionid)
    }
}
impl old_trainmore_common {
    #[deprecated(note = "use api::trainmore::common::default_bad_tags instead")]
    pub fn default_bad_tags(&self) -> DataArray {
        self::trainmore::common::default_bad_tags()
    }
    #[deprecated(note = "use api::trainmore::common::download_checkpoint instead")]
    pub fn download_checkpoint(&self, checkpoint: String) -> String {
        self::trainmore::common::download_checkpoint(checkpoint)
    }
    #[deprecated(note = "use api::trainmore::common::install_realesrgan instead")]
    pub fn install_realesrgan(&self) -> DataObject {
        self::trainmore::common::install_realesrgan()
    }
    #[deprecated(note = "use api::trainmore::common::install_smiling_wolf instead")]
    pub fn install_smiling_wolf(&self) -> DataObject {
        self::trainmore::common::install_smiling_wolf()
    }
    #[deprecated(note = "use api::trainmore::common::load_dataset_tags instead")]
    pub fn load_dataset_tags(&self, dir: String) -> DataObject {
        self::trainmore::common::load_dataset_tags(dir)
    }
    #[deprecated(note = "use api::trainmore::common::parse_tags instead")]
    pub fn parse_tags(&self, tags: DataObject, bad_tags: DataArray) -> DataObject {
        self::trainmore::common::parse_tags(tags, bad_tags)
    }
    #[deprecated(note = "use api::trainmore::common::pg_bad_tags instead")]
    pub fn pg_bad_tags(&self) -> DataArray {
        self::trainmore::common::pg_bad_tags()
    }
    #[deprecated(note = "use api::trainmore::common::pull_dataset instead")]
    pub fn pull_dataset(&self, job: DataObject) -> DataObject {
        self::trainmore::common::pull_dataset(job)
    }
    #[deprecated(note = "use api::trainmore::common::tags_to_prompt instead")]
    pub fn tags_to_prompt(&self, o: DataObject, trigger: String, gender: String, num_tags: i64, random: bool) -> String {
        self::trainmore::common::tags_to_prompt(o, trigger, gender, num_tags, random)
    }
    #[deprecated(note = "use api::trainmore::common::write_lora_tags instead")]
    pub fn write_lora_tags(&self, lora_path: String, tags: DataObject) -> DataObject {
        self::trainmore::common::write_lora_tags(lora_path, tags)
    }
    #[deprecated(note = "use api::trainmore::common::get_gpu_name instead")]
    pub fn get_gpu_name(&self) -> String {
        self::trainmore::common::get_gpu_name()
    }
    #[deprecated(note = "use api::trainmore::common::capture_captions instead")]
    pub fn capture_captions(&self, jobid: String, captions: DataObject) -> String {
        self::trainmore::common::capture_captions(jobid, captions)
    }
    #[deprecated(note = "use api::trainmore::common::restore_captions instead")]
    pub fn restore_captions(&self, storeid: String, jobid: String) -> DataObject {
        self::trainmore::common::restore_captions(storeid, jobid)
    }
    #[deprecated(note = "use api::trainmore::common::ensure_trigger instead")]
    pub fn ensure_trigger(&self, dir: String, trigger: String) -> DataObject {
        self::trainmore::common::ensure_trigger(dir, trigger)
    }
    #[deprecated(note = "use api::trainmore::common::load_user_captions instead")]
    pub fn load_user_captions(&self, dir: String) -> DataObject {
        self::trainmore::common::load_user_captions(dir)
    }
}
impl old_trainmore_ernie {
    #[deprecated(note = "use api::trainmore::ernie::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::ernie::install()
    }
    #[deprecated(note = "use api::trainmore::ernie::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::ernie::train(job)
    }
}
impl old_trainmore_flux {
    #[deprecated(note = "use api::trainmore::flux::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::flux::install()
    }
    #[deprecated(note = "use api::trainmore::flux::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::flux::train(job)
    }
}
impl old_trainmore_flux2 {
    #[deprecated(note = "use api::trainmore::flux2::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::flux2::install()
    }
    #[deprecated(note = "use api::trainmore::flux2::install_klein instead")]
    pub fn install_klein(&self) -> DataObject {
        self::trainmore::flux2::install_klein()
    }
    #[deprecated(note = "use api::trainmore::flux2::train instead")]
    pub fn train(&self, job: DataObject) -> DataObject {
        self::trainmore::flux2::train(job)
    }
    #[deprecated(note = "use api::trainmore::flux2::train_klein instead")]
    pub fn train_klein(&self, job: DataObject) -> String {
        self::trainmore::flux2::train_klein(job)
    }
}
impl old_trainmore_hunyuan {
    #[deprecated(note = "use api::trainmore::hunyuan::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::hunyuan::install()
    }
    #[deprecated(note = "use api::trainmore::hunyuan::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::hunyuan::train(job)
    }
}
impl old_trainmore_ideogram4 {
    #[deprecated(note = "use api::trainmore::ideogram4::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::ideogram4::install()
    }
    #[deprecated(note = "use api::trainmore::ideogram4::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::ideogram4::train(job)
    }
    #[deprecated(note = "use api::trainmore::ideogram4::add_trigger_to_captions instead")]
    pub fn add_trigger_to_captions(&self, dir: String, trigger: String) -> bool {
        self::trainmore::ideogram4::add_trigger_to_captions(dir, trigger)
    }
}
impl old_trainmore_ltx2 {
    #[deprecated(note = "use api::trainmore::ltx2::caption_videos instead")]
    pub fn caption_videos(&self, job: DataObject) -> DataObject {
        self::trainmore::ltx2::caption_videos(job)
    }
    #[deprecated(note = "use api::trainmore::ltx2::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::ltx2::install()
    }
    #[deprecated(note = "use api::trainmore::ltx2::process_dataset instead")]
    pub fn process_dataset(&self, job: DataObject) -> DataObject {
        self::trainmore::ltx2::process_dataset(job)
    }
    #[deprecated(note = "use api::trainmore::ltx2::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::ltx2::train(job)
    }
}
impl old_trainmore_qweni {
    #[deprecated(note = "use api::trainmore::qweni::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::qweni::install()
    }
    #[deprecated(note = "use api::trainmore::qweni::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::qweni::train(job)
    }
}
impl old_trainmore_sdxl {
    #[deprecated(note = "use api::trainmore::sdxl::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::sdxl::install()
    }
    #[deprecated(note = "use api::trainmore::sdxl::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::sdxl::train(job)
    }
}
impl old_trainmore_trainmore {
    #[deprecated(note = "use api::trainmore::trainmore::dataset_to_lora instead")]
    pub fn dataset_to_lora(&self, job: DataObject) -> DataObject {
        self::trainmore::trainmore::dataset_to_lora(job)
    }
}
impl old_trainmore_wan {
    #[deprecated(note = "use api::trainmore::wan::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::wan::install()
    }
    #[deprecated(note = "use api::trainmore::wan::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::wan::train(job)
    }
}
impl old_trainmore_wan22 {
    #[deprecated(note = "use api::trainmore::wan22::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::wan22::install()
    }
    #[deprecated(note = "use api::trainmore::wan22::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::wan22::train(job)
    }
}
impl old_trainmore_zimg {
    #[deprecated(note = "use api::trainmore::zimg::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::zimg::install()
    }
    #[deprecated(note = "use api::trainmore::zimg::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::zimg::train(job)
    }
}
impl old_trainmore_krea2 {
    #[deprecated(note = "use api::trainmore::krea2::install instead")]
    pub fn install(&self) -> DataObject {
        self::trainmore::krea2::install()
    }
    #[deprecated(note = "use api::trainmore::krea2::train instead")]
    pub fn train(&self, job: DataObject) -> String {
        self::trainmore::krea2::train(job)
    }
}
