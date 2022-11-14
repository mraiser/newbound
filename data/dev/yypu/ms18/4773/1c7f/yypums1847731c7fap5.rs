if build_lib(lib.to_owned()) {
  let store = DataStore::new();
  let root = store.get_lib_root(&lib);
  let ja = build_compile_command(root);
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja);
  if b { panic!("{}",s); }
}
"OK".to_string()