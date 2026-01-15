let ja = build_compile_command();

let base_path = DataStore::new().root.canonicalize().unwrap();
let mut base_path = base_path.parent().unwrap();
let base_path = base_path.display().to_string();
println!("cd {}; {}", &base_path, ja.to_string());


let (b, s) = execute_compile_command(ja, base_path);
if b { panic!("{}",s); }
println!("Compile OK");
"OK".to_string()
