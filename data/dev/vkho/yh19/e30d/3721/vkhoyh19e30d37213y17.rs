let real_id = lookup_id(lib.clone(), id);
DataStore::new().get_data(&lib, &real_id)