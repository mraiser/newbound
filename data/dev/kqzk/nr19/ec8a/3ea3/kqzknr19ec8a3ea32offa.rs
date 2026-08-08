let store = DataStore::new();
if store.exists(&lib, "controls") {
    return format!("OK (library `{}` already exists; unchanged)", &lib);
}
crate::api::new().app.app.newlib(lib, DataArray::new(), DataArray::new())