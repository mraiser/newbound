let mut out = DataObject::new();
out.put_string("status", "ok");
out.put_string("scope", "shared journaled facet storage");
out.put_string("lib", &lib);
out.put_string("id", &id);
out.put_boolean("plan_sharded", is_plan(&lib, &id));
out