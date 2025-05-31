use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use ndata::databytes::DataBytes;
use ndata::data::Data;
use flowlang::rustcmd::RustCmd;

pub struct flow_case {}
pub struct flow_checkicon {}
pub struct flow_conditionalicon {}
pub struct flow_editor {}
pub struct flow_failicon {}
pub struct flow_inputbar {}
pub struct flow_listicon {}
pub struct flow_loopicon {}
pub struct flow_node {}
pub struct flow_node_editor {}
pub struct flow_operation {}
pub struct flow_operation_editor {}
pub struct flow_xicon {}
pub struct flow_interpreter {}
pub struct app_api {}
pub struct app_app {}
pub struct app_appcard {}
pub struct app_appinfo {}
pub struct app_dial {}
pub struct app_list {}
pub struct app_list_item {}
pub struct app_login {}
pub struct app_scenegraph {}
pub struct app_select {}
pub struct app_service {}
pub struct app_shape {}
pub struct app_ui {}
pub struct app_ui_reference {}
pub struct app_util {}
pub struct security_security {}
pub struct dev_dev {}
pub struct dev_edit3d {}
pub struct dev_editcommand {}
pub struct dev_editcontrol {}
pub struct dev_editevent {}
pub struct dev_edittimer {}
pub struct dev_github {}
pub struct dev_libinfo {}
pub struct dev_selectctl {}
pub struct dev_selectlib {}
pub struct dev_libsettings {}
pub struct peer_headsup {}
pub struct peer_peer {}
pub struct peer_peer_model {}
pub struct peer_reboot {}
pub struct peer_service {}
pub struct peer_peer_select {}

pub struct flow {
  pub case: flow_case,
  pub checkicon: flow_checkicon,
  pub conditionalicon: flow_conditionalicon,
  pub editor: flow_editor,
  pub failicon: flow_failicon,
  pub inputbar: flow_inputbar,
  pub listicon: flow_listicon,
  pub loopicon: flow_loopicon,
  pub node: flow_node,
  pub node_editor: flow_node_editor,
  pub operation: flow_operation,
  pub operation_editor: flow_operation_editor,
  pub xicon: flow_xicon,
  pub interpreter: flow_interpreter,
}
pub struct app {
  pub api: app_api,
  pub app: app_app,
  pub appcard: app_appcard,
  pub appinfo: app_appinfo,
  pub dial: app_dial,
  pub list: app_list,
  pub list_item: app_list_item,
  pub login: app_login,
  pub scenegraph: app_scenegraph,
  pub select: app_select,
  pub service: app_service,
  pub shape: app_shape,
  pub ui: app_ui,
  pub ui_reference: app_ui_reference,
  pub util: app_util,
}
pub struct security {
  pub security: security_security,
}
pub struct dev {
  pub dev: dev_dev,
  pub edit3d: dev_edit3d,
  pub editcommand: dev_editcommand,
  pub editcontrol: dev_editcontrol,
  pub editevent: dev_editevent,
  pub edittimer: dev_edittimer,
  pub github: dev_github,
  pub libinfo: dev_libinfo,
  pub selectctl: dev_selectctl,
  pub selectlib: dev_selectlib,
  pub libsettings: dev_libsettings,
}
pub struct peer {
  pub headsup: peer_headsup,
  pub peer: peer_peer,
  pub peer_model: peer_peer_model,
  pub reboot: peer_reboot,
  pub service: peer_service,
  pub peer_select: peer_peer_select,
}

pub struct api {
  pub flow: flow,
  pub app: app,
  pub security: security,
  pub dev: dev,
  pub peer: peer,
}
pub const fn new() -> api {
  api {
    flow: flow {
      case: flow_case {},
      checkicon: flow_checkicon {},
      conditionalicon: flow_conditionalicon {},
      editor: flow_editor {},
      failicon: flow_failicon {},
      inputbar: flow_inputbar {},
      listicon: flow_listicon {},
      loopicon: flow_loopicon {},
      node: flow_node {},
      node_editor: flow_node_editor {},
      operation: flow_operation {},
      operation_editor: flow_operation_editor {},
      xicon: flow_xicon {},
      interpreter: flow_interpreter {},
    },
    app: app {
      api: app_api {},
      app: app_app {},
      appcard: app_appcard {},
      appinfo: app_appinfo {},
      dial: app_dial {},
      list: app_list {},
      list_item: app_list_item {},
      login: app_login {},
      scenegraph: app_scenegraph {},
      select: app_select {},
      service: app_service {},
      shape: app_shape {},
      ui: app_ui {},
      ui_reference: app_ui_reference {},
      util: app_util {},
    },
    security: security {
      security: security_security {},
    },
    dev: dev {
      dev: dev_dev {},
      edit3d: dev_edit3d {},
      editcommand: dev_editcommand {},
      editcontrol: dev_editcontrol {},
      editevent: dev_editevent {},
      edittimer: dev_edittimer {},
      github: dev_github {},
      libinfo: dev_libinfo {},
      selectctl: dev_selectctl {},
      selectlib: dev_selectlib {},
      libsettings: dev_libsettings {},
    },
    peer: peer {
      headsup: peer_headsup {},
      peer: peer_peer {},
      peer_model: peer_peer_model {},
      reboot: peer_reboot {},
      service: peer_service {},
      peer_select: peer_peer_select {},
    },
  }
}

impl app_app {
  pub fn apps (&self) -> DataArray {
    let d = DataObject::new();
    RustCmd::new("ynjjnl182f0c30c2ej26bb").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn asset (&self, nn_path: String) -> String {
    let mut d = DataObject::new();
    d.put_string("nn_path", &nn_path);
    RustCmd::new("hxusrn182ebab0fc8o1102").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn assets (&self, lib: String) -> DataArray {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    RustCmd::new("uirppm183059f5a37z1b0c").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn delete (&self, lib: String, id: String, nn_sessionid: String) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("id", &id);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("mhnrjq18347bcd5f7t27").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn deletelib (&self, lib: String) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    RustCmd::new("hkgorn1834268eb07k1406").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn deviceid (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("jypyqw1836795f8fbn2").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn eventoff (&self, id: String) -> String {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    RustCmd::new("xrysgt18350cb35cet3").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn eventon (&self, id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    d.put_string("app", &app);
    d.put_string("event", &event);
    d.put_string("cmdlib", &cmdlib);
    d.put_string("cmdid", &cmdid);
    RustCmd::new("wlnoru18350ecc36cr4").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn events (&self, app: String) -> DataArray {
    let mut d = DataObject::new();
    d.put_string("app", &app);
    RustCmd::new("spumvi1834c2cf1e6t2").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn exec (&self, lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("id", &id);
    d.put_object("args", args);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("thoxjp182ee8eaebdt225").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn jsapi (&self, nn_path: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("nn_path", &nn_path);
    RustCmd::new("zmzwjn182ee9c7f0ar314").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn libs (&self) -> DataArray {
    let d = DataObject::new();
    RustCmd::new("vtnluk1834262fb3fl137e").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn login (&self, user: String, pass: String, nn_sessionid: String) -> String {
    let mut d = DataObject::new();
    d.put_string("user", &user);
    d.put_string("pass", &pass);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("ztizvj182ee99186cp2d2").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn newlib (&self, lib: String, readers: DataArray, writers: DataArray) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_array("readers", readers);
    d.put_array("writers", writers);
    RustCmd::new("stskpj183421d8115xd3f").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn read (&self, lib: String, id: String, nn_sessionid: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("id", &id);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("nyzimq182eabf7339p7c5").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn remembersession (&self, nn_session: DataObject) -> String {
    let mut d = DataObject::new();
    d.put_object("nn_session", nn_session);
    RustCmd::new("tsmxsj182ee9ac271o2f3").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn settings (&self, settings: Data) -> DataObject {
    let mut d = DataObject::new();
    d.set_property("settings", settings);
    RustCmd::new("knhvsn182f9997b1dxd04").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn timeroff (&self, id: String) -> String {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    RustCmd::new("hompli1835678a4efz2").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn timeron (&self, id: String, data: DataObject) -> String {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    d.put_object("data", data);
    RustCmd::new("spjvvp183568021f1o2").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn uninstall (&self, app: String) -> String {
    let mut d = DataObject::new();
    d.put_string("app", &app);
    RustCmd::new("gttrqg18303bc96c9w898").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn unique_session_id (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("ynpmir183479da2b9r25f8").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn write (&self, lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.set_property("id", id);
    d.put_object("data", data);
    d.set_property("readers", readers);
    d.set_property("writers", writers);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("yjjxqk18303e75f8atb5a").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn spawn (&self, lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("ctl", &ctl);
    d.put_string("cmd", &cmd);
    d.put_object("args", args);
    RustCmd::new("tvigvw19268109f0fg2a60").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
impl app_service {
  pub fn init (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("mjkrmm183e1fdb2d2r8").execute(d).expect("Rust command execution failed").get_string("a")
  }
}
impl app_util {
  pub fn hash (&self, file: String) -> String {
    let mut d = DataObject::new();
    d.put_string("file", &file);
    RustCmd::new("kgkxpw183664f5554q4").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn init (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("thtpku18366290644p4").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn zip (&self, srcdir: String, destfile: String) -> bool {
    let mut d = DataObject::new();
    d.put_string("srcdir", &srcdir);
    d.put_string("destfile", &destfile);
    RustCmd::new("guuqrj1836147b650zd").execute(d).expect("Rust command execution failed").get_boolean("a")
  }
}
impl security_security {
  pub fn current_user (&self, nn_session: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_object("nn_session", nn_session);
    RustCmd::new("ihxsxh18410251dfapf7").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn deleteuser (&self, id: String) -> String {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    RustCmd::new("jszjgy1836bfe023ckc").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn groups (&self) -> DataArray {
    let d = DataObject::new();
    RustCmd::new("qjmvtm1836b1bc850o9").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn init (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("suvlkp1846cfa2235q2c").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn setuser (&self, id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    d.put_string("displayname", &displayname);
    d.put_string("password", &password);
    d.put_array("groups", groups);
    d.set_property("keepalive", keepalive);
    d.set_property("address", address);
    d.set_property("port", port);
    RustCmd::new("soqxoo1836bb51d5dy2").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn users (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("ysnihn1836b0814aen5").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
impl dev_dev {
  pub fn check (&self, lib: String, ctl: String, cmd: String) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("ctl", &ctl);
    d.put_string("cmd", &cmd);
    RustCmd::new("gsxkwg184e3fc96f9s2e1").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn compile (&self, lib: String, ctl: String, cmd: String) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_string("ctl", &ctl);
    d.put_string("cmd", &cmd);
    RustCmd::new("gjssly1834862d5acg37d9").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn compile_rust (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("mhxogz1858786d9e1scf").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn install_lib (&self, uuid: String, lib: String) -> bool {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_string("lib", &lib);
    RustCmd::new("kqgjmx1840a9081cdh172").execute(d).expect("Rust command execution failed").get_boolean("a")
  }
  pub fn lib_archive (&self, lib: String, version: i64) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    d.put_int("version", version);
    RustCmd::new("uykmrm183dbd15cdeu7b").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn lib_info (&self, lib: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    RustCmd::new("knwozu1840a764abcu135").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn rebuild_lib (&self, lib: String) -> String {
    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    RustCmd::new("yypums1847731c7fap5").execute(d).expect("Rust command execution failed").get_string("a")
  }
}
impl dev_editcontrol {
  pub fn appdata (&self, data: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_object("data", data);
    RustCmd::new("vsxqui18332a86185i159").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn publishapp (&self, data: DataObject) -> DataArray {
    let mut d = DataObject::new();
    d.put_object("data", data);
    RustCmd::new("iwvgmq1835bb194ffo8").execute(d).expect("Rust command execution failed").get_array("a")
  }
}
impl dev_github {
  pub fn import (&self, url: String) -> String {
    let mut d = DataObject::new();
    d.put_string("url", &url);
    RustCmd::new("nnjgwh189dcdca95fq7c").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn list (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("lovuhn189dc981ebch2f").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
impl dev_libsettings {
  pub fn get_library_config (&self, id: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("id", &id);
    RustCmd::new("gxysqz19721b331c9r54").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn save_library_config (&self, data: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_object("data", data);
    RustCmd::new("wjhsqs19720f20d2ct8d").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
impl peer_peer {
  pub fn discovery (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("mlrhvx183e6eabd19xb4").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn info (&self, nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("nn_sessionid", &nn_sessionid);
    d.set_property("uuid", uuid);
    d.set_property("salt", salt);
    RustCmd::new("tkwkml18390d46728m8").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn local (&self, request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
    let mut d = DataObject::new();
    d.put_object("request", request);
    d.put_object("nn_session", nn_session);
    d.put_string("nn_sessionid", &nn_sessionid);
    RustCmd::new("nylhvq183f6b61e43oc2").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn peers (&self) -> DataArray {
    let d = DataObject::new();
    RustCmd::new("ywokvt1838c110d92l8").execute(d).expect("Rust command execution failed").get_array("a")
  }
  pub fn remote (&self, nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
    let mut d = DataObject::new();
    d.put_string("nn_path", &nn_path);
    d.put_object("nn_params", nn_params);
    d.put_object("nn_headers", nn_headers);
    RustCmd::new("txnvil183f6ffdf58w1d").execute(d).expect("Rust command execution failed").get_bytes("a")
  }
}
impl peer_reboot {
  pub fn init (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("hygrki1842eac55a9w2a").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn reboot (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("jmhvzv1843439faa0i305").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
impl peer_service {
  pub fn close_stream (&self, uuid: String, streamid: i64, write: bool) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_int("streamid", streamid);
    d.put_boolean("write", write);
    RustCmd::new("zqxtsm18d3d4ef2b3j101").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn discovery (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("vtxmqr183e5ff3ef5u82").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn exec (&self, uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_string("app", &app);
    d.put_string("cmd", &cmd);
    d.put_object("params", params);
    RustCmd::new("nmojwg18386b2f0d2n2").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn get_stream (&self, uuid: String, stream_id: i64) -> DataBytes {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_int("stream_id", stream_id);
    RustCmd::new("hlmugl188ab38379arb5").execute(d).expect("Rust command execution failed").get_bytes("a")
  }
  pub fn init (&self) -> DataObject {
    let d = DataObject::new();
    RustCmd::new("grvupm18379e9a159n8").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn listen (&self, ipaddr: String, port: i64) -> i64 {
    let mut d = DataObject::new();
    d.put_string("ipaddr", &ipaddr);
    d.put_int("port", port);
    RustCmd::new("irxuhn18379cef5bcp4").execute(d).expect("Rust command execution failed").get_int("a")
  }
  pub fn listen_udp (&self, ipaddr: String, port: i64) -> i64 {
    let mut d = DataObject::new();
    d.put_string("ipaddr", &ipaddr);
    d.put_int("port", port);
    RustCmd::new("rgxowg183ad6b7a12u6").execute(d).expect("Rust command execution failed").get_int("a")
  }
  pub fn maintenance (&self) -> String {
    let d = DataObject::new();
    RustCmd::new("rjntml18385b15b5ch0").execute(d).expect("Rust command execution failed").get_string("a")
  }
  pub fn new_stream (&self, uuid: String) -> i64 {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    RustCmd::new("myuvuz18d36f76d2cg3").execute(d).expect("Rust command execution failed").get_int("a")
  }
  pub fn session_expire (&self, user: DataObject) -> DataObject {
    let mut d = DataObject::new();
    d.put_object("user", user);
    RustCmd::new("lvvzvn183bd066566j4").execute(d).expect("Rust command execution failed").get_object("a")
  }
  pub fn stream_write (&self, uuid: String, stream_id: i64, data: DataBytes) -> bool {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_int("stream_id", stream_id);
    d.put_bytes("data", data);
    RustCmd::new("pmumpq18d39a2594cp3").execute(d).expect("Rust command execution failed").get_boolean("a")
  }
  pub fn tcp_connect (&self, uuid: String, ipaddr: String, port: i64) -> bool {
    let mut d = DataObject::new();
    d.put_string("uuid", &uuid);
    d.put_string("ipaddr", &ipaddr);
    d.put_int("port", port);
    RustCmd::new("ltnpiq18385ba6cc7u3").execute(d).expect("Rust command execution failed").get_boolean("a")
  }
  pub fn udp_connect (&self, ipaddr: String, port: i64) -> DataObject {
    let mut d = DataObject::new();
    d.put_string("ipaddr", &ipaddr);
    d.put_int("port", port);
    RustCmd::new("gloivk183adf03115od").execute(d).expect("Rust command execution failed").get_object("a")
  }
}
