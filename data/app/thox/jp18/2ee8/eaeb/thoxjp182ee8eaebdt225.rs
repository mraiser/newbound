if check_auth(&lib, &id, &nn_sessionid, false) {
  let mut args = args.clone();
  args.put_string("nn_sessionid", &nn_sessionid);
  let command = Command::new(&lib, &id);
  command.cast_params(args.clone());
  let o = command.execute(args).unwrap();
  return format_result(command, o);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")