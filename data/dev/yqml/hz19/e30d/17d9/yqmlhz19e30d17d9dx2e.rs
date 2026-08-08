let real_id = id.clone(); //lookup_id(lib.clone(), id);
DataStore::new().get_data(&lib, &real_id).get_object("data")