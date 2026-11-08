let sid = request.get_object("params").get_string("nn_sessionid");
crate::app::service::init::handle_command(request, sid)