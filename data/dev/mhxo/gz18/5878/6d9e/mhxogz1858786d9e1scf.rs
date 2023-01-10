let ja = build_compile_command();
println!("{}", ja.to_string());
let (b, s) = execute_compile_command(ja);
if b { panic!("{}",s); }
println!("Compile OK");
"OK".to_string()