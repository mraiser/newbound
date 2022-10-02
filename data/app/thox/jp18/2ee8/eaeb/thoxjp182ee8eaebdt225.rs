if check_auth(&lib, &id, &nn_sessionid, false) {
  let mut args = args.duplicate();
  args.put_str("nn_sessionid", &nn_sessionid);
  let command = Command::new(&lib, &id);
  command.cast_params(args.duplicate());
  let o = command.execute(args).unwrap();
  return format_result(command, o);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")