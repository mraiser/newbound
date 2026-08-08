let api = crate::api::new();
let store = DataStore::new();
let mut results = DataArray::new();
let needle = query.to_lowercase();

// Retrieve all libraries available in the environment
let libs_array = api.app.app.libs();

for i in 0..libs_array.len() {
    // app.app.libs() answers with library META OBJECTS (id, root, version,
    // desc, author...), not names. get_string(i) on an object entry does not
    // yield the id, so `current_lib` was never a real library, store.exists()
    // was always false, and this command returned an EMPTY array for every
    // query ever run against it — silently, because empty reads as "no
    // matches". Handle both shapes in case libs() ever answers with names.
    let lib_entry = libs_array.get_property(i);
    let current_lib = if lib_entry.is_object() {
        lib_entry.object().get_string("id")
    } else {
        lib_entry.string()
    };

    // Scope to specific lib if provided (allow "*" or empty string as wildcard)
    if lib != "*" && !lib.is_empty() && current_lib != lib {
        continue;
    }

    if store.exists(&current_lib, "controls") {
        let ctls_obj = store.get_data(&current_lib, "controls").get_object("data");
        if ctls_obj.has("list") {
            let ctls_list = ctls_obj.get_array("list");

            for j in 0..ctls_list.len() {
                let ctl_item = ctls_list.get_object(j);
                let current_ctl = ctl_item.get_string("name");
                let ctl_id = ctl_item.get_string("id");

                // Scope to specific ctl if provided (allow "*" or empty string as wildcard)
                if ctl != "*" && !ctl.is_empty() && current_ctl != ctl {
                    continue;
                }

                if store.exists(&current_lib, &ctl_id) {
                    let ctl_doc = store.get_data(&current_lib, &ctl_id).get_object("data");

                    if ctl_doc.has("cmd") {
                        let cmds_list = ctl_doc.get_array("cmd");

                        for k in 0..cmds_list.len() {
                            let cmd_item = cmds_list.get_object(k);
                            let current_cmd = cmd_item.get_string("name");
                            let cmd_id = cmd_item.get_string("id");

                            if store.exists(&current_lib, &cmd_id) {
                                let cmd_data = store.get_data(&current_lib, &cmd_id).get_object("data");
                                let lang = if cmd_data.has("type") { cmd_data.get_string("type") } else { "rust".to_string() };

                                // The searchable text: command name, parameter names,
                                // desc, imports, and the implementation body, matched
                                // case-insensitively. A command with no impl record
                                // (or a flow command, whose body is an attachment)
                                // still matches on its name.
                                let mut haystack = current_cmd.to_owned();

                                if cmd_data.has(&lang) {
                                    let impl_id = cmd_data.get_string(&lang);

                                    if store.exists(&current_lib, &impl_id) {
                                        let impl_data = store.get_data(&current_lib, &impl_id).get_object("data");

                                        if impl_data.has("desc") && impl_data.get_property("desc").is_string() {
                                            haystack.push_str("\n");
                                            haystack.push_str(&impl_data.get_string("desc"));
                                        }
                                        if impl_data.has("import") && impl_data.get_property("import").is_string() {
                                            haystack.push_str("\n");
                                            haystack.push_str(&impl_data.get_string("import"));
                                        }
                                        if impl_data.has("params") && impl_data.get_property("params").is_array() {
                                            let params_list = impl_data.get_array("params");
                                            for m in 0..params_list.len() {
                                                let param_item = params_list.get_object(m);
                                                if param_item.has("name") {
                                                    haystack.push_str("\n");
                                                    haystack.push_str(&param_item.get_string("name"));
                                                }
                                            }
                                        }

                                        let ext = if lang == "rust" { "rs".to_string() } else { lang.to_owned() };
                                        if impl_data.has(&ext) && impl_data.get_property(&ext).is_string() {
                                            haystack.push_str("\n");
                                            haystack.push_str(&impl_data.get_string(&ext));
                                        }
                                    }
                                }

                                if haystack.to_lowercase().contains(&needle) {
                                    let mut match_obj = DataObject::new();
                                    match_obj.put_string("lib", &current_lib);
                                    match_obj.put_string("ctl", &current_ctl);
                                    match_obj.put_string("cmd", &current_cmd);
                                    results.push_object(match_obj);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

results