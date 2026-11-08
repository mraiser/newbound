let mut out = DataObject::new();
out.put_string("status", "ok");
out.put_string("scope", "atomic per-entry facet journal");
out.put_string("lib", &lib);
out.put_string("id", &id);
out