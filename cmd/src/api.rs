#![allow(non_camel_case_types, unused_variables, unused_imports, dead_code)]
pub use ::ndata::dataobject::DataObject;
pub use ::ndata::dataarray::DataArray;
pub use ::ndata::databytes::DataBytes;
pub use ::ndata::data::Data;

pub mod app {
    pub mod api {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod app {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn apps() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ynjjnl182f0c30c2ej26bb").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn asset(nn_path: String) -> String {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            ::flowlang::rustcmd::RustCmd::new("hxusrn182ebab0fc8o1102").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn assets(lib: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("uirppm183059f5a37z1b0c").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn delete(lib: String, id: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("mhnrjq18347bcd5f7t27").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn deletelib(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("hkgorn1834268eb07k1406").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn deviceid() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jypyqw1836795f8fbn2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn eventoff(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("xrysgt18350cb35cet3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn eventon(id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("app", &app);
            d.put_string("event", &event);
            d.put_string("cmdlib", &cmdlib);
            d.put_string("cmdid", &cmdid);
            ::flowlang::rustcmd::RustCmd::new("wlnoru18350ecc36cr4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn events(app: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("app", &app);
            ::flowlang::rustcmd::RustCmd::new("spumvi1834c2cf1e6t2").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn exec(lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_object("args", args);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("thoxjp182ee8eaebdt225").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn jsapi(nn_path: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            ::flowlang::rustcmd::RustCmd::new("zmzwjn182ee9c7f0ar314").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn libs() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtnluk1834262fb3fl137e").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn login(user: String, pass: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("user", &user);
            d.put_string("pass", &pass);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ztizvj182ee99186cp2d2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn newlib(lib: String, readers: DataArray, writers: DataArray) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_array("readers", readers);
            d.put_array("writers", writers);
            ::flowlang::rustcmd::RustCmd::new("stskpj183421d8115xd3f").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn read(lib: String, id: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nyzimq182eabf7339p7c5").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remembersession(nn_session: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_object("nn_session", nn_session);
            ::flowlang::rustcmd::RustCmd::new("tsmxsj182ee9ac271o2f3").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn settings(settings: Data) -> DataObject {
            let mut d = DataObject::new();
            d.set_property("settings", settings);
            ::flowlang::rustcmd::RustCmd::new("knhvsn182f9997b1dxd04").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn spawn(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("args", args);
            ::flowlang::rustcmd::RustCmd::new("tvigvw19268109f0fg2a60").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn timeroff(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("hompli1835678a4efz2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn timeron(id: String, data: DataObject) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("spjvvp183568021f1o2").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn uninstall(app: String) -> String {
            let mut d = DataObject::new();
            d.put_string("app", &app);
            ::flowlang::rustcmd::RustCmd::new("gttrqg18303bc96c9w898").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn unique_session_id() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ynpmir183479da2b9r25f8").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn write(lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.set_property("id", id);
            d.put_object("data", data);
            d.set_property("readers", readers);
            d.set_property("writers", writers);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("yjjxqk18303e75f8atb5a").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod appcard {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod appinfo {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod dial {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod list {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod list_item {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod login {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenegraph {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod select {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod service {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn init() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mjkrmm183e1fdb2d2r8").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod shape {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod ui {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod ui_reference {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod util {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn hash(file: String) -> String {
            let mut d = DataObject::new();
            d.put_string("file", &file);
            ::flowlang::rustcmd::RustCmd::new("kgkxpw183664f5554q4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn init() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("thtpku18366290644p4").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn zip(srcdir: String, destfile: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("srcdir", &srcdir);
            d.put_string("destfile", &destfile);
            ::flowlang::rustcmd::RustCmd::new("guuqrj1836147b650zd").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

    }
    pub mod player {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneplayer {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneexpr {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenetokens {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenedoc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneproject {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod scenerun {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod forcelayout {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod store {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod nb {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod tokens {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod webgl {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod loader {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod bridge {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod modules {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod dev {
    pub mod dev {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn check(lib: String, ctl: String, cmd: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("gsxkwg184e3fc96f9s2e1").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn compile(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("gjssly1834862d5acg37d9").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn compile_rust() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mhxogz1858786d9e1scf").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn install_lib(uuid: String, lib: String) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("kqgjmx1840a9081cdh172").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn lib_archive(lib: String, version: i64) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_int("version", version);
            ::flowlang::rustcmd::RustCmd::new("uykmrm183dbd15cdeu7b").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn lib_info(lib: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("knwozu1840a764abcu135").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rebuild_lib(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("yypums1847731c7fap5").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod editcommand {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn compile_command(lib: String, control_name: String, cmd_name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_name", &control_name);
            d.put_string("cmd_name", &cmd_name);
            ::flowlang::rustcmd::RustCmd::new("wmjmsm19e30a16655r3439").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_command(lib: String, control_id: String, cmd_id: String, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("cmd_id", &cmd_id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("zjkntl19e309a2635o3426").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn save_command(lib: String, cmd_id: String, lang: String, code: String, imports: String, returntype: String, params: DataArray, desc: String, groups: String, readers: DataArray, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("cmd_id", &cmd_id);
            d.put_string("lang", &lang);
            d.put_string("code", &code);
            d.put_string("imports", &imports);
            d.put_string("returntype", &returntype);
            d.put_array("params", params);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            d.put_array("readers", readers);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("yqvnwh19e30916b04l3410").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn read_command(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("hkhmnw19e55777c46x41").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lookup_cmd_id(lib: String, ctl: String, cmd: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("vpqniv19e558047aeo59").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod editcontrol {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn add_component(lib: String, control_id: String, component_type: String, name: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("component_type", &component_type);
            d.put_string("name", &name);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ywmyvk19e2d0d215ai2c5b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn appdata(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("vsxqui18332a86185i159").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_control(lib: String, id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("ljxttx19e2c502d8bg2ab1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_publish_context(lib: String, control_id: String, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("control_id", &control_id);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("lhknos19e2d258cb6w2c94").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn lookup_id(lib: String, name: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("ggkslj19e2c58bb61q2ac8").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn publishapp(data: DataObject) -> DataArray {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("iwvgmq1835bb194ffo8").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn save_control(lib: String, id: String, html: String, css: String, js: String, groups: String, desc: String, readers: DataArray, inline_data: DataObject, nn_sessionid: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("id", &id);
            d.put_string("html", &html);
            d.put_string("css", &css);
            d.put_string("js", &js);
            d.put_string("groups", &groups);
            d.put_string("desc", &desc);
            d.put_array("readers", readers);
            d.put_object("inline_data", inline_data);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("uwoygr19e2c6bab55r2af6").execute(d).expect("Rust command execution failed").get_string("a")
        }

    }
    pub mod github {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn import(url: String) -> String {
            let mut d = DataObject::new();
            d.put_string("url", &url);
            ::flowlang::rustcmd::RustCmd::new("nnjgwh189dcdca95fq7c").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn list() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lovuhn189dc981ebch2f").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod libsettings {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn get_library_config(id: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("gxysqz19721b331c9r54").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn save_library_config(data: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("data", data);
            ::flowlang::rustcmd::RustCmd::new("wjhsqs19720f20d2ct8d").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod plugins {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_plugins() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("zvmhyt19763d3e070i43").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod workbench {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod sceneeditor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod floweditor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod floweditor3d {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod editor {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod preview {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod shelf {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod card {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod jump {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod frame {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod toast {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod session {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowdoc {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowproject {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowprims {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod flowlayout {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod facets {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod chatctx {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod devmodules {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod code {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn list_commands(lib: String, ctl: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("ypmryt19ec1558019m1c2c").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_controls(lib: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("nhpgow19e9ddf15a2k6").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn list_libraries() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mtjtsw19e9dd5bcefg1de5").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn add_library(lib: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("kqzknr19ec8a3ea32offa").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn add_control(lib: String, ctl: String) -> String {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("lmywwj19ec8a9e2ccm100b").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn upsert_command(lib: String, ctl: String, cmd: String, lang: String, return_type: String, params: DataArray, imports: String, code_body: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("lang", &lang);
            d.put_string("return_type", &return_type);
            d.put_array("params", params);
            d.put_string("imports", &imports);
            d.put_string("code_body", &code_body);
            ::flowlang::rustcmd::RustCmd::new("ovwolr19ec8c38800z1047").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn patch_command_body(lib: String, ctl: String, cmd: String, old_snippet: String, new_snippet: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("old_snippet", &old_snippet);
            d.put_string("new_snippet", &new_snippet);
            ::flowlang::rustcmd::RustCmd::new("slvzur19ed5ad5cc7k2c99").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_command(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("krpzxz19ed5b4aed9v2cad").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_command(lib: String, ctl: String, cmd: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("xqjpyg19ed5c0337dy2cca").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn search_commands(lib: String, ctl: String, query: String) -> DataArray {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("query", &query);
            ::flowlang::rustcmd::RustCmd::new("shlglp19ed5d11bf9i2cf3").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn invoke_command(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("args", args);
            ::flowlang::rustcmd::RustCmd::new("hviwtu19ed5dc7dc5x2d10").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn evaluate_rust(imports: String, code: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("imports", &imports);
            d.put_string("code", &code);
            ::flowlang::rustcmd::RustCmd::new("nwnguj19ee5977c28s1527").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_control_facet(lib: String, ctl: String, facet: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("facet", &facet);
            ::flowlang::rustcmd::RustCmd::new("vwswvs19f95a61d29j3943").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn patch_control_facet(lib: String, ctl: String, facet: String, old_snippet: String, new_snippet: String, base: String, label: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("facet", &facet);
            d.put_string("old_snippet", &old_snippet);
            d.put_string("new_snippet", &new_snippet);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("uyonls19f95a61d2cp3945").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn list_control_patches(lib: String, ctl: String, limit: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_int("limit", limit);
            ::flowlang::rustcmd::RustCmd::new("zkjqpy19f95a61d2eu3947").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_library_meta(lib: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("ouqqjw19f95a61d2fu3949").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_control_meta(lib: String, ctl: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("trogig19f95a61d30w394b").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_command_meta(lib: String, ctl: String, cmd: String, desc: String, groups: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("desc", &desc);
            d.put_string("groups", &groups);
            ::flowlang::rustcmd::RustCmd::new("hlsjpo19f95a61d32q394d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn list_assets(lib: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            ::flowlang::rustcmd::RustCmd::new("iltsxi19f96bdd724l566d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_asset(lib: String, name: String, content: String, tempfile: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            d.put_string("content", &content);
            d.put_string("tempfile", &tempfile);
            ::flowlang::rustcmd::RustCmd::new("vxxmwl19f96bdd725r566f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn rename_asset(lib: String, from: String, to: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("from", &from);
            d.put_string("to", &to);
            ::flowlang::rustcmd::RustCmd::new("qosxxk19f96bdd725z5671").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_asset(lib: String, name: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("name", &name);
            ::flowlang::rustcmd::RustCmd::new("qvipjk19f96bdd726s5673").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_flow_body(lib: String, ctl: String, cmd: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            ::flowlang::rustcmd::RustCmd::new("nprqom19f9925517fn789d").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_flow_body(lib: String, ctl: String, cmd: String, body: DataObject, base: String, label: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_object("body", body);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("vksvyz19f99255185j789f").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_timer(lib: String, ctl: String, name: String, cmd: String, start: i64, startunit: String, interval: i64, intervalunit: String, repeat: bool, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("cmd", &cmd);
            d.put_int("start", start);
            d.put_string("startunit", &startunit);
            d.put_int("interval", interval);
            d.put_string("intervalunit", &intervalunit);
            d.put_boolean("repeat", repeat);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("kxtnil19f99e8b05bj9cfd").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_timer(lib: String, ctl: String, name: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("ppjvhg19f99e8b05fv9cff").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_event_handler(lib: String, ctl: String, name: String, bot: String, event: String, cmd: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("bot", &bot);
            d.put_string("event", &event);
            d.put_string("cmd", &cmd);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("slwolg19f99e8b060l9d01").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_event_handler(lib: String, ctl: String, name: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("name", &name);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("lyqmyx19f99e8b061q9d03").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn read_control_scene(lib: String, ctl: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            ::flowlang::rustcmd::RustCmd::new("vtynpg19fa345cd8eyb2ff").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn write_control_scene(lib: String, ctl: String, scene: DataObject, base: String, label: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_object("scene", scene);
            d.put_string("base", &base);
            d.put_string("label", &label);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("ltwuws19fa345cd8erb301").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_library(lib: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("juhgqn19faf571a9az1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn delete_control(lib: String, ctl: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("tjhhxj19faf577471h1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn move_control(lib: String, ctl: String, to_lib: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("to_lib", &to_lib);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("pyjtgq19fb05aeb0cm1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_meta_identity(displayname: String, organization: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("displayname", &displayname);
            d.put_string("organization", &organization);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("pxilgw19fb08d4430k1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_meta_identity() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("lgiozw19fb094fdfau1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn unpublish_app(lib: String, app: String, remove_runtime: bool, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("app", &app);
            d.put_boolean("remove_runtime", remove_runtime);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("ijyuys19fb09ff451g1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_module_flag(lib: String, ctl: String, module: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("module", &module);
            ::flowlang::rustcmd::RustCmd::new("mmtgzg19fb2da96a9g1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_plugin(name: String, target_lib: String, target_ctl: String, plugin_lib: String, plugin_ctl: String, selector: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("target_lib", &target_lib);
            d.put_string("target_ctl", &target_ctl);
            d.put_string("plugin_lib", &plugin_lib);
            d.put_string("plugin_ctl", &plugin_ctl);
            d.put_string("selector", &selector);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("owxtlg19fb3b6cfd6v1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remove_plugin(name: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("name", &name);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("znpnwu19fb3b71711u3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_tags(lib: String, ctl: String, cmd: String, tags: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("tags", &tags);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("vsxqpy19fb84a1ba4m1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_groups(lib: String, ctl: String, cmd: String, groups: String, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("groups", &groups);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("ywwgiq19fb84a4e57h3").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn remember(lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("domain", &domain);
            d.put_object("entry", entry);
            d.put_string("author", &author);
            ::flowlang::rustcmd::RustCmd::new("zjqnjs19fb8b46738r1").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn set_command_imports(lib: String, ctl: String, cmd: String, imports: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("lib", &lib);
            d.put_string("ctl", &ctl);
            d.put_string("cmd", &cmd);
            d.put_string("imports", &imports);
            ::flowlang::rustcmd::RustCmd::new("opoush19fbdfbfefbn1").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod prompts {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod peer {
    pub mod headsup {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod peer {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn discovery() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("mlrhvx183e6eabd19xb4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn info(nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            d.set_property("uuid", uuid);
            d.set_property("salt", salt);
            ::flowlang::rustcmd::RustCmd::new("tkwkml18390d46728m8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn local(request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("request", request);
            d.put_object("nn_session", nn_session);
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("nylhvq183f6b61e43oc2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn peers() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ywokvt1838c110d92l8").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn remote(nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
            let mut d = DataObject::new();
            d.put_string("nn_path", &nn_path);
            d.put_object("nn_params", nn_params);
            d.put_object("nn_headers", nn_headers);
            ::flowlang::rustcmd::RustCmd::new("txnvil183f6ffdf58w1d").execute(d).expect("Rust command execution failed").get_bytes("a")
        }

    }
    pub mod peer_model {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
    pub mod reboot {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("hygrki1842eac55a9w2a").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn reboot() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("jmhvzv1843439faa0i305").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod service {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn close_stream(uuid: String, streamid: i64, write: bool) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("streamid", streamid);
            d.put_boolean("write", write);
            ::flowlang::rustcmd::RustCmd::new("zqxtsm18d3d4ef2b3j101").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn discovery() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("vtxmqr183e5ff3ef5u82").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn exec(uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("app", &app);
            d.put_string("cmd", &cmd);
            d.put_object("params", params);
            ::flowlang::rustcmd::RustCmd::new("nmojwg18386b2f0d2n2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn get_stream(uuid: String, stream_id: i64) -> DataBytes {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("stream_id", stream_id);
            ::flowlang::rustcmd::RustCmd::new("hlmugl188ab38379arb5").execute(d).expect("Rust command execution failed").get_bytes("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("grvupm18379e9a159n8").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn listen(ipaddr: String, port: i64) -> i64 {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("irxuhn18379cef5bcp4").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn listen_udp(ipaddr: String, port: i64) -> i64 {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("rgxowg183ad6b7a12u6").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn maintenance() -> String {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("rjntml18385b15b5ch0").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn new_stream(uuid: String) -> i64 {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            ::flowlang::rustcmd::RustCmd::new("myuvuz18d36f76d2cg3").execute(d).expect("Rust command execution failed").get_int("a")
        }

        pub fn session_expire(user: DataObject) -> DataObject {
            let mut d = DataObject::new();
            d.put_object("user", user);
            ::flowlang::rustcmd::RustCmd::new("lvvzvn183bd066566j4").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn stream_write(uuid: String, stream_id: i64, data: DataBytes) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_int("stream_id", stream_id);
            d.put_bytes("data", data);
            ::flowlang::rustcmd::RustCmd::new("pmumpq18d39a2594cp3").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn tcp_connect(uuid: String, ipaddr: String, port: i64) -> bool {
            let mut d = DataObject::new();
            d.put_string("uuid", &uuid);
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("ltnpiq18385ba6cc7u3").execute(d).expect("Rust command execution failed").get_boolean("a")
        }

        pub fn udp_connect(ipaddr: String, port: i64) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("ipaddr", &ipaddr);
            d.put_int("port", port);
            ::flowlang::rustcmd::RustCmd::new("gloivk183adf03115od").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
    pub mod peer_select {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

    }
}

pub mod runtime {
}

pub mod security {
    pub mod security {
        use ::ndata::dataobject::DataObject;
        use ::ndata::dataarray::DataArray;
        use ::ndata::databytes::DataBytes;
        use ::ndata::data::Data;

        pub fn current_user(nn_sessionid: String) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("nn_sessionid", &nn_sessionid);
            ::flowlang::rustcmd::RustCmd::new("ihxsxh18410251dfapf7").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn deleteuser(id: String) -> String {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            ::flowlang::rustcmd::RustCmd::new("jszjgy1836bfe023ckc").execute(d).expect("Rust command execution failed").get_string("a")
        }

        pub fn groups() -> DataArray {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("qjmvtm1836b1bc850o9").execute(d).expect("Rust command execution failed").get_array("a")
        }

        pub fn init() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("suvlkp1846cfa2235q2c").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn setuser(id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
            let mut d = DataObject::new();
            d.put_string("id", &id);
            d.put_string("displayname", &displayname);
            d.put_string("password", &password);
            d.put_array("groups", groups);
            d.set_property("keepalive", keepalive);
            d.set_property("address", address);
            d.set_property("port", port);
            ::flowlang::rustcmd::RustCmd::new("soqxoo1836bb51d5dy2").execute(d).expect("Rust command execution failed").get_object("a")
        }

        pub fn users() -> DataObject {
            let d = DataObject::new();
            ::flowlang::rustcmd::RustCmd::new("ysnihn1836b0814aen5").execute(d).expect("Rust command execution failed").get_object("a")
        }

    }
}

pub struct old_app_api {}
pub struct old_app_app {}
pub struct old_app_appcard {}
pub struct old_app_appinfo {}
pub struct old_app_dial {}
pub struct old_app_list {}
pub struct old_app_list_item {}
pub struct old_app_login {}
pub struct old_app_scenegraph {}
pub struct old_app_select {}
pub struct old_app_service {}
pub struct old_app_shape {}
pub struct old_app_ui {}
pub struct old_app_ui_reference {}
pub struct old_app_util {}
pub struct old_app_player {}
pub struct old_app_sceneplayer {}
pub struct old_app_sceneexpr {}
pub struct old_app_scenetokens {}
pub struct old_app_scenedoc {}
pub struct old_app_sceneproject {}
pub struct old_app_scenerun {}
pub struct old_app_forcelayout {}
pub struct old_app_store {}
pub struct old_app_nb {}
pub struct old_app_tokens {}
pub struct old_app_webgl {}
pub struct old_app_loader {}
pub struct old_app_bridge {}
pub struct old_app_modules {}
pub struct old_dev_dev {}
pub struct old_dev_editcommand {}
pub struct old_dev_editcontrol {}
pub struct old_dev_github {}
pub struct old_dev_libsettings {}
pub struct old_dev_plugins {}
pub struct old_dev_workbench {}
pub struct old_dev_sceneeditor {}
pub struct old_dev_floweditor {}
pub struct old_dev_floweditor3d {}
pub struct old_dev_editor {}
pub struct old_dev_preview {}
pub struct old_dev_shelf {}
pub struct old_dev_card {}
pub struct old_dev_jump {}
pub struct old_dev_frame {}
pub struct old_dev_toast {}
pub struct old_dev_session {}
pub struct old_dev_flowdoc {}
pub struct old_dev_flowproject {}
pub struct old_dev_flowprims {}
pub struct old_dev_flowlayout {}
pub struct old_dev_facets {}
pub struct old_dev_chatctx {}
pub struct old_dev_devmodules {}
pub struct old_dev_code {}
pub struct old_dev_prompts {}
pub struct old_peer_headsup {}
pub struct old_peer_peer {}
pub struct old_peer_peer_model {}
pub struct old_peer_reboot {}
pub struct old_peer_service {}
pub struct old_peer_peer_select {}
pub struct old_security_security {}
pub struct old_app {
    pub api: old_app_api,
    pub app: old_app_app,
    pub appcard: old_app_appcard,
    pub appinfo: old_app_appinfo,
    pub dial: old_app_dial,
    pub list: old_app_list,
    pub list_item: old_app_list_item,
    pub login: old_app_login,
    pub scenegraph: old_app_scenegraph,
    pub select: old_app_select,
    pub service: old_app_service,
    pub shape: old_app_shape,
    pub ui: old_app_ui,
    pub ui_reference: old_app_ui_reference,
    pub util: old_app_util,
    pub player: old_app_player,
    pub sceneplayer: old_app_sceneplayer,
    pub sceneexpr: old_app_sceneexpr,
    pub scenetokens: old_app_scenetokens,
    pub scenedoc: old_app_scenedoc,
    pub sceneproject: old_app_sceneproject,
    pub scenerun: old_app_scenerun,
    pub forcelayout: old_app_forcelayout,
    pub store: old_app_store,
    pub nb: old_app_nb,
    pub tokens: old_app_tokens,
    pub webgl: old_app_webgl,
    pub loader: old_app_loader,
    pub bridge: old_app_bridge,
    pub modules: old_app_modules,
}
pub struct old_dev {
    pub dev: old_dev_dev,
    pub editcommand: old_dev_editcommand,
    pub editcontrol: old_dev_editcontrol,
    pub github: old_dev_github,
    pub libsettings: old_dev_libsettings,
    pub plugins: old_dev_plugins,
    pub workbench: old_dev_workbench,
    pub sceneeditor: old_dev_sceneeditor,
    pub floweditor: old_dev_floweditor,
    pub floweditor3d: old_dev_floweditor3d,
    pub editor: old_dev_editor,
    pub preview: old_dev_preview,
    pub shelf: old_dev_shelf,
    pub card: old_dev_card,
    pub jump: old_dev_jump,
    pub frame: old_dev_frame,
    pub toast: old_dev_toast,
    pub session: old_dev_session,
    pub flowdoc: old_dev_flowdoc,
    pub flowproject: old_dev_flowproject,
    pub flowprims: old_dev_flowprims,
    pub flowlayout: old_dev_flowlayout,
    pub facets: old_dev_facets,
    pub chatctx: old_dev_chatctx,
    pub devmodules: old_dev_devmodules,
    pub code: old_dev_code,
    pub prompts: old_dev_prompts,
}
pub struct old_peer {
    pub headsup: old_peer_headsup,
    pub peer: old_peer_peer,
    pub peer_model: old_peer_peer_model,
    pub reboot: old_peer_reboot,
    pub service: old_peer_service,
    pub peer_select: old_peer_peer_select,
}
pub struct old_runtime {
}
pub struct old_security {
    pub security: old_security_security,
}
pub struct api {
    pub app: old_app,
    pub dev: old_dev,
    pub peer: old_peer,
    pub runtime: old_runtime,
    pub security: old_security,
}

pub const fn new() -> api {
    api {
        app: old_app {
            api: old_app_api {},
            app: old_app_app {},
            appcard: old_app_appcard {},
            appinfo: old_app_appinfo {},
            dial: old_app_dial {},
            list: old_app_list {},
            list_item: old_app_list_item {},
            login: old_app_login {},
            scenegraph: old_app_scenegraph {},
            select: old_app_select {},
            service: old_app_service {},
            shape: old_app_shape {},
            ui: old_app_ui {},
            ui_reference: old_app_ui_reference {},
            util: old_app_util {},
            player: old_app_player {},
            sceneplayer: old_app_sceneplayer {},
            sceneexpr: old_app_sceneexpr {},
            scenetokens: old_app_scenetokens {},
            scenedoc: old_app_scenedoc {},
            sceneproject: old_app_sceneproject {},
            scenerun: old_app_scenerun {},
            forcelayout: old_app_forcelayout {},
            store: old_app_store {},
            nb: old_app_nb {},
            tokens: old_app_tokens {},
            webgl: old_app_webgl {},
            loader: old_app_loader {},
            bridge: old_app_bridge {},
            modules: old_app_modules {},
        },
        dev: old_dev {
            dev: old_dev_dev {},
            editcommand: old_dev_editcommand {},
            editcontrol: old_dev_editcontrol {},
            github: old_dev_github {},
            libsettings: old_dev_libsettings {},
            plugins: old_dev_plugins {},
            workbench: old_dev_workbench {},
            sceneeditor: old_dev_sceneeditor {},
            floweditor: old_dev_floweditor {},
            floweditor3d: old_dev_floweditor3d {},
            editor: old_dev_editor {},
            preview: old_dev_preview {},
            shelf: old_dev_shelf {},
            card: old_dev_card {},
            jump: old_dev_jump {},
            frame: old_dev_frame {},
            toast: old_dev_toast {},
            session: old_dev_session {},
            flowdoc: old_dev_flowdoc {},
            flowproject: old_dev_flowproject {},
            flowprims: old_dev_flowprims {},
            flowlayout: old_dev_flowlayout {},
            facets: old_dev_facets {},
            chatctx: old_dev_chatctx {},
            devmodules: old_dev_devmodules {},
            code: old_dev_code {},
            prompts: old_dev_prompts {},
        },
        peer: old_peer {
            headsup: old_peer_headsup {},
            peer: old_peer_peer {},
            peer_model: old_peer_peer_model {},
            reboot: old_peer_reboot {},
            service: old_peer_service {},
            peer_select: old_peer_peer_select {},
        },
        runtime: old_runtime {
        },
        security: old_security {
            security: old_security_security {},
        },
    }
}

impl old_app_app {
    #[deprecated(note = "use api::app::app::apps instead")]
    pub fn apps(&self) -> DataArray {
        self::app::app::apps()
    }
    #[deprecated(note = "use api::app::app::asset instead")]
    pub fn asset(&self, nn_path: String) -> String {
        self::app::app::asset(nn_path)
    }
    #[deprecated(note = "use api::app::app::assets instead")]
    pub fn assets(&self, lib: String) -> DataArray {
        self::app::app::assets(lib)
    }
    #[deprecated(note = "use api::app::app::delete instead")]
    pub fn delete(&self, lib: String, id: String, nn_sessionid: String) -> String {
        self::app::app::delete(lib, id, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::deletelib instead")]
    pub fn deletelib(&self, lib: String) -> String {
        self::app::app::deletelib(lib)
    }
    #[deprecated(note = "use api::app::app::deviceid instead")]
    pub fn deviceid(&self) -> String {
        self::app::app::deviceid()
    }
    #[deprecated(note = "use api::app::app::eventoff instead")]
    pub fn eventoff(&self, id: String) -> String {
        self::app::app::eventoff(id)
    }
    #[deprecated(note = "use api::app::app::eventon instead")]
    pub fn eventon(&self, id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
        self::app::app::eventon(id, app, event, cmdlib, cmdid)
    }
    #[deprecated(note = "use api::app::app::events instead")]
    pub fn events(&self, app: String) -> DataArray {
        self::app::app::events(app)
    }
    #[deprecated(note = "use api::app::app::exec instead")]
    pub fn exec(&self, lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
        self::app::app::exec(lib, id, args, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::jsapi instead")]
    pub fn jsapi(&self, nn_path: String) -> DataObject {
        self::app::app::jsapi(nn_path)
    }
    #[deprecated(note = "use api::app::app::libs instead")]
    pub fn libs(&self) -> DataArray {
        self::app::app::libs()
    }
    #[deprecated(note = "use api::app::app::login instead")]
    pub fn login(&self, user: String, pass: String, nn_sessionid: String) -> String {
        self::app::app::login(user, pass, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::newlib instead")]
    pub fn newlib(&self, lib: String, readers: DataArray, writers: DataArray) -> String {
        self::app::app::newlib(lib, readers, writers)
    }
    #[deprecated(note = "use api::app::app::read instead")]
    pub fn read(&self, lib: String, id: String, nn_sessionid: String) -> DataObject {
        self::app::app::read(lib, id, nn_sessionid)
    }
    #[deprecated(note = "use api::app::app::remembersession instead")]
    pub fn remembersession(&self, nn_session: DataObject) -> String {
        self::app::app::remembersession(nn_session)
    }
    #[deprecated(note = "use api::app::app::settings instead")]
    pub fn settings(&self, settings: Data) -> DataObject {
        self::app::app::settings(settings)
    }
    #[deprecated(note = "use api::app::app::spawn instead")]
    pub fn spawn(&self, lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
        self::app::app::spawn(lib, ctl, cmd, args)
    }
    #[deprecated(note = "use api::app::app::timeroff instead")]
    pub fn timeroff(&self, id: String) -> String {
        self::app::app::timeroff(id)
    }
    #[deprecated(note = "use api::app::app::timeron instead")]
    pub fn timeron(&self, id: String, data: DataObject) -> String {
        self::app::app::timeron(id, data)
    }
    #[deprecated(note = "use api::app::app::uninstall instead")]
    pub fn uninstall(&self, app: String) -> String {
        self::app::app::uninstall(app)
    }
    #[deprecated(note = "use api::app::app::unique_session_id instead")]
    pub fn unique_session_id(&self) -> String {
        self::app::app::unique_session_id()
    }
    #[deprecated(note = "use api::app::app::write instead")]
    pub fn write(&self, lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
        self::app::app::write(lib, id, data, readers, writers, nn_sessionid)
    }
}
impl old_app_service {
    #[deprecated(note = "use api::app::service::init instead")]
    pub fn init(&self) -> String {
        self::app::service::init()
    }
}
impl old_app_util {
    #[deprecated(note = "use api::app::util::hash instead")]
    pub fn hash(&self, file: String) -> String {
        self::app::util::hash(file)
    }
    #[deprecated(note = "use api::app::util::init instead")]
    pub fn init(&self) -> String {
        self::app::util::init()
    }
    #[deprecated(note = "use api::app::util::zip instead")]
    pub fn zip(&self, srcdir: String, destfile: String) -> bool {
        self::app::util::zip(srcdir, destfile)
    }
}
impl old_dev_dev {
    #[deprecated(note = "use api::dev::dev::check instead")]
    pub fn check(&self, lib: String, ctl: String, cmd: String) -> String {
        self::dev::dev::check(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::dev::compile instead")]
    pub fn compile(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::dev::compile(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::dev::compile_rust instead")]
    pub fn compile_rust(&self) -> String {
        self::dev::dev::compile_rust()
    }
    #[deprecated(note = "use api::dev::dev::install_lib instead")]
    pub fn install_lib(&self, uuid: String, lib: String) -> bool {
        self::dev::dev::install_lib(uuid, lib)
    }
    #[deprecated(note = "use api::dev::dev::lib_archive instead")]
    pub fn lib_archive(&self, lib: String, version: i64) -> String {
        self::dev::dev::lib_archive(lib, version)
    }
    #[deprecated(note = "use api::dev::dev::lib_info instead")]
    pub fn lib_info(&self, lib: String) -> DataObject {
        self::dev::dev::lib_info(lib)
    }
    #[deprecated(note = "use api::dev::dev::rebuild_lib instead")]
    pub fn rebuild_lib(&self, lib: String) -> String {
        self::dev::dev::rebuild_lib(lib)
    }
}
impl old_dev_editcommand {
    #[deprecated(note = "use api::dev::editcommand::compile_command instead")]
    pub fn compile_command(&self, lib: String, control_name: String, cmd_name: String) -> DataObject {
        self::dev::editcommand::compile_command(lib, control_name, cmd_name)
    }
    #[deprecated(note = "use api::dev::editcommand::delete_command instead")]
    pub fn delete_command(&self, lib: String, control_id: String, cmd_id: String, nn_sessionid: String) -> String {
        self::dev::editcommand::delete_command(lib, control_id, cmd_id, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcommand::save_command instead")]
    pub fn save_command(&self, lib: String, cmd_id: String, lang: String, code: String, imports: String, returntype: String, params: DataArray, desc: String, groups: String, readers: DataArray, nn_sessionid: String) -> String {
        self::dev::editcommand::save_command(lib, cmd_id, lang, code, imports, returntype, params, desc, groups, readers, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcommand::read_command instead")]
    pub fn read_command(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::editcommand::read_command(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::editcommand::lookup_cmd_id instead")]
    pub fn lookup_cmd_id(&self, lib: String, ctl: String, cmd: String) -> String {
        self::dev::editcommand::lookup_cmd_id(lib, ctl, cmd)
    }
}
impl old_dev_editcontrol {
    #[deprecated(note = "use api::dev::editcontrol::add_component instead")]
    pub fn add_component(&self, lib: String, control_id: String, component_type: String, name: String, nn_sessionid: String) -> DataObject {
        self::dev::editcontrol::add_component(lib, control_id, component_type, name, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcontrol::appdata instead")]
    pub fn appdata(&self, data: DataObject) -> DataObject {
        self::dev::editcontrol::appdata(data)
    }
    #[deprecated(note = "use api::dev::editcontrol::get_control instead")]
    pub fn get_control(&self, lib: String, id: String) -> DataObject {
        self::dev::editcontrol::get_control(lib, id)
    }
    #[deprecated(note = "use api::dev::editcontrol::get_publish_context instead")]
    pub fn get_publish_context(&self, lib: String, control_id: String, nn_sessionid: String) -> DataObject {
        self::dev::editcontrol::get_publish_context(lib, control_id, nn_sessionid)
    }
    #[deprecated(note = "use api::dev::editcontrol::lookup_id instead")]
    pub fn lookup_id(&self, lib: String, name: String) -> String {
        self::dev::editcontrol::lookup_id(lib, name)
    }
    #[deprecated(note = "use api::dev::editcontrol::publishapp instead")]
    pub fn publishapp(&self, data: DataObject) -> DataArray {
        self::dev::editcontrol::publishapp(data)
    }
    #[deprecated(note = "use api::dev::editcontrol::save_control instead")]
    pub fn save_control(&self, lib: String, id: String, html: String, css: String, js: String, groups: String, desc: String, readers: DataArray, inline_data: DataObject, nn_sessionid: String) -> String {
        self::dev::editcontrol::save_control(lib, id, html, css, js, groups, desc, readers, inline_data, nn_sessionid)
    }
}
impl old_dev_github {
    #[deprecated(note = "use api::dev::github::import instead")]
    pub fn import(&self, url: String) -> String {
        self::dev::github::import(url)
    }
    #[deprecated(note = "use api::dev::github::list instead")]
    pub fn list(&self) -> DataObject {
        self::dev::github::list()
    }
}
impl old_dev_libsettings {
    #[deprecated(note = "use api::dev::libsettings::get_library_config instead")]
    pub fn get_library_config(&self, id: String) -> DataObject {
        self::dev::libsettings::get_library_config(id)
    }
    #[deprecated(note = "use api::dev::libsettings::save_library_config instead")]
    pub fn save_library_config(&self, data: DataObject) -> DataObject {
        self::dev::libsettings::save_library_config(data)
    }
}
impl old_dev_plugins {
    #[deprecated(note = "use api::dev::plugins::list_plugins instead")]
    pub fn list_plugins(&self) -> DataObject {
        self::dev::plugins::list_plugins()
    }
}
impl old_dev_code {
    #[deprecated(note = "use api::dev::code::list_commands instead")]
    pub fn list_commands(&self, lib: String, ctl: String) -> DataArray {
        self::dev::code::list_commands(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::list_controls instead")]
    pub fn list_controls(&self, lib: String) -> DataArray {
        self::dev::code::list_controls(lib)
    }
    #[deprecated(note = "use api::dev::code::list_libraries instead")]
    pub fn list_libraries(&self) -> DataArray {
        self::dev::code::list_libraries()
    }
    #[deprecated(note = "use api::dev::code::add_library instead")]
    pub fn add_library(&self, lib: String) -> String {
        self::dev::code::add_library(lib)
    }
    #[deprecated(note = "use api::dev::code::add_control instead")]
    pub fn add_control(&self, lib: String, ctl: String) -> String {
        self::dev::code::add_control(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::upsert_command instead")]
    pub fn upsert_command(&self, lib: String, ctl: String, cmd: String, lang: String, return_type: String, params: DataArray, imports: String, code_body: String) -> DataObject {
        self::dev::code::upsert_command(lib, ctl, cmd, lang, return_type, params, imports, code_body)
    }
    #[deprecated(note = "use api::dev::code::patch_command_body instead")]
    pub fn patch_command_body(&self, lib: String, ctl: String, cmd: String, old_snippet: String, new_snippet: String) -> DataObject {
        self::dev::code::patch_command_body(lib, ctl, cmd, old_snippet, new_snippet)
    }
    #[deprecated(note = "use api::dev::code::read_command instead")]
    pub fn read_command(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::code::read_command(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::code::delete_command instead")]
    pub fn delete_command(&self, lib: String, ctl: String, cmd: String, author: String) -> DataObject {
        self::dev::code::delete_command(lib, ctl, cmd, author)
    }
    #[deprecated(note = "use api::dev::code::search_commands instead")]
    pub fn search_commands(&self, lib: String, ctl: String, query: String) -> DataArray {
        self::dev::code::search_commands(lib, ctl, query)
    }
    #[deprecated(note = "use api::dev::code::invoke_command instead")]
    pub fn invoke_command(&self, lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
        self::dev::code::invoke_command(lib, ctl, cmd, args)
    }
    #[deprecated(note = "use api::dev::code::evaluate_rust instead")]
    pub fn evaluate_rust(&self, imports: String, code: String) -> DataObject {
        self::dev::code::evaluate_rust(imports, code)
    }
    #[deprecated(note = "use api::dev::code::read_control_facet instead")]
    pub fn read_control_facet(&self, lib: String, ctl: String, facet: String) -> DataObject {
        self::dev::code::read_control_facet(lib, ctl, facet)
    }
    #[deprecated(note = "use api::dev::code::patch_control_facet instead")]
    pub fn patch_control_facet(&self, lib: String, ctl: String, facet: String, old_snippet: String, new_snippet: String, base: String, label: String, author: String) -> DataObject {
        self::dev::code::patch_control_facet(lib, ctl, facet, old_snippet, new_snippet, base, label, author)
    }
    #[deprecated(note = "use api::dev::code::list_control_patches instead")]
    pub fn list_control_patches(&self, lib: String, ctl: String, limit: i64) -> DataObject {
        self::dev::code::list_control_patches(lib, ctl, limit)
    }
    #[deprecated(note = "use api::dev::code::set_library_meta instead")]
    pub fn set_library_meta(&self, lib: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_library_meta(lib, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::set_control_meta instead")]
    pub fn set_control_meta(&self, lib: String, ctl: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_control_meta(lib, ctl, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::set_command_meta instead")]
    pub fn set_command_meta(&self, lib: String, ctl: String, cmd: String, desc: String, groups: String) -> DataObject {
        self::dev::code::set_command_meta(lib, ctl, cmd, desc, groups)
    }
    #[deprecated(note = "use api::dev::code::list_assets instead")]
    pub fn list_assets(&self, lib: String) -> DataObject {
        self::dev::code::list_assets(lib)
    }
    #[deprecated(note = "use api::dev::code::write_asset instead")]
    pub fn write_asset(&self, lib: String, name: String, content: String, tempfile: String) -> DataObject {
        self::dev::code::write_asset(lib, name, content, tempfile)
    }
    #[deprecated(note = "use api::dev::code::rename_asset instead")]
    pub fn rename_asset(&self, lib: String, from: String, to: String) -> DataObject {
        self::dev::code::rename_asset(lib, from, to)
    }
    #[deprecated(note = "use api::dev::code::delete_asset instead")]
    pub fn delete_asset(&self, lib: String, name: String) -> DataObject {
        self::dev::code::delete_asset(lib, name)
    }
    #[deprecated(note = "use api::dev::code::read_flow_body instead")]
    pub fn read_flow_body(&self, lib: String, ctl: String, cmd: String) -> DataObject {
        self::dev::code::read_flow_body(lib, ctl, cmd)
    }
    #[deprecated(note = "use api::dev::code::write_flow_body instead")]
    pub fn write_flow_body(&self, lib: String, ctl: String, cmd: String, body: DataObject, base: String, label: String, author: String) -> DataObject {
        self::dev::code::write_flow_body(lib, ctl, cmd, body, base, label, author)
    }
    #[deprecated(note = "use api::dev::code::set_timer instead")]
    pub fn set_timer(&self, lib: String, ctl: String, name: String, cmd: String, start: i64, startunit: String, interval: i64, intervalunit: String, repeat: bool, author: String) -> DataObject {
        self::dev::code::set_timer(lib, ctl, name, cmd, start, startunit, interval, intervalunit, repeat, author)
    }
    #[deprecated(note = "use api::dev::code::remove_timer instead")]
    pub fn remove_timer(&self, lib: String, ctl: String, name: String, author: String) -> DataObject {
        self::dev::code::remove_timer(lib, ctl, name, author)
    }
    #[deprecated(note = "use api::dev::code::set_event_handler instead")]
    pub fn set_event_handler(&self, lib: String, ctl: String, name: String, bot: String, event: String, cmd: String, author: String) -> DataObject {
        self::dev::code::set_event_handler(lib, ctl, name, bot, event, cmd, author)
    }
    #[deprecated(note = "use api::dev::code::remove_event_handler instead")]
    pub fn remove_event_handler(&self, lib: String, ctl: String, name: String, author: String) -> DataObject {
        self::dev::code::remove_event_handler(lib, ctl, name, author)
    }
    #[deprecated(note = "use api::dev::code::read_control_scene instead")]
    pub fn read_control_scene(&self, lib: String, ctl: String) -> DataObject {
        self::dev::code::read_control_scene(lib, ctl)
    }
    #[deprecated(note = "use api::dev::code::write_control_scene instead")]
    pub fn write_control_scene(&self, lib: String, ctl: String, scene: DataObject, base: String, label: String, author: String) -> DataObject {
        self::dev::code::write_control_scene(lib, ctl, scene, base, label, author)
    }
    #[deprecated(note = "use api::dev::code::delete_library instead")]
    pub fn delete_library(&self, lib: String, author: String) -> DataObject {
        self::dev::code::delete_library(lib, author)
    }
    #[deprecated(note = "use api::dev::code::delete_control instead")]
    pub fn delete_control(&self, lib: String, ctl: String, author: String) -> DataObject {
        self::dev::code::delete_control(lib, ctl, author)
    }
    #[deprecated(note = "use api::dev::code::move_control instead")]
    pub fn move_control(&self, lib: String, ctl: String, to_lib: String, author: String) -> DataObject {
        self::dev::code::move_control(lib, ctl, to_lib, author)
    }
    #[deprecated(note = "use api::dev::code::set_meta_identity instead")]
    pub fn set_meta_identity(&self, displayname: String, organization: String, author: String) -> DataObject {
        self::dev::code::set_meta_identity(displayname, organization, author)
    }
    #[deprecated(note = "use api::dev::code::get_meta_identity instead")]
    pub fn get_meta_identity(&self) -> DataObject {
        self::dev::code::get_meta_identity()
    }
    #[deprecated(note = "use api::dev::code::unpublish_app instead")]
    pub fn unpublish_app(&self, lib: String, app: String, remove_runtime: bool, author: String) -> DataObject {
        self::dev::code::unpublish_app(lib, app, remove_runtime, author)
    }
    #[deprecated(note = "use api::dev::code::set_module_flag instead")]
    pub fn set_module_flag(&self, lib: String, ctl: String, module: String) -> DataObject {
        self::dev::code::set_module_flag(lib, ctl, module)
    }
    #[deprecated(note = "use api::dev::code::set_plugin instead")]
    pub fn set_plugin(&self, name: String, target_lib: String, target_ctl: String, plugin_lib: String, plugin_ctl: String, selector: String, author: String) -> DataObject {
        self::dev::code::set_plugin(name, target_lib, target_ctl, plugin_lib, plugin_ctl, selector, author)
    }
    #[deprecated(note = "use api::dev::code::remove_plugin instead")]
    pub fn remove_plugin(&self, name: String, author: String) -> DataObject {
        self::dev::code::remove_plugin(name, author)
    }
    #[deprecated(note = "use api::dev::code::set_tags instead")]
    pub fn set_tags(&self, lib: String, ctl: String, cmd: String, tags: String, author: String) -> DataObject {
        self::dev::code::set_tags(lib, ctl, cmd, tags, author)
    }
    #[deprecated(note = "use api::dev::code::set_groups instead")]
    pub fn set_groups(&self, lib: String, ctl: String, cmd: String, groups: String, author: String) -> DataObject {
        self::dev::code::set_groups(lib, ctl, cmd, groups, author)
    }
    #[deprecated(note = "use api::dev::code::remember instead")]
    pub fn remember(&self, lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
        self::dev::code::remember(lib, domain, entry, author)
    }
    #[deprecated(note = "use api::dev::code::set_command_imports instead")]
    pub fn set_command_imports(&self, lib: String, ctl: String, cmd: String, imports: String) -> DataObject {
        self::dev::code::set_command_imports(lib, ctl, cmd, imports)
    }
}
impl old_peer_peer {
    #[deprecated(note = "use api::peer::peer::discovery instead")]
    pub fn discovery(&self) -> DataObject {
        self::peer::peer::discovery()
    }
    #[deprecated(note = "use api::peer::peer::info instead")]
    pub fn info(&self, nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
        self::peer::peer::info(nn_sessionid, uuid, salt)
    }
    #[deprecated(note = "use api::peer::peer::local instead")]
    pub fn local(&self, request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
        self::peer::peer::local(request, nn_session, nn_sessionid)
    }
    #[deprecated(note = "use api::peer::peer::peers instead")]
    pub fn peers(&self) -> DataArray {
        self::peer::peer::peers()
    }
    #[deprecated(note = "use api::peer::peer::remote instead")]
    pub fn remote(&self, nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
        self::peer::peer::remote(nn_path, nn_params, nn_headers)
    }
}
impl old_peer_reboot {
    #[deprecated(note = "use api::peer::reboot::init instead")]
    pub fn init(&self) -> DataObject {
        self::peer::reboot::init()
    }
    #[deprecated(note = "use api::peer::reboot::reboot instead")]
    pub fn reboot(&self) -> DataObject {
        self::peer::reboot::reboot()
    }
}
impl old_peer_service {
    #[deprecated(note = "use api::peer::service::close_stream instead")]
    pub fn close_stream(&self, uuid: String, streamid: i64, write: bool) -> DataObject {
        self::peer::service::close_stream(uuid, streamid, write)
    }
    #[deprecated(note = "use api::peer::service::discovery instead")]
    pub fn discovery(&self) -> String {
        self::peer::service::discovery()
    }
    #[deprecated(note = "use api::peer::service::exec instead")]
    pub fn exec(&self, uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
        self::peer::service::exec(uuid, app, cmd, params)
    }
    #[deprecated(note = "use api::peer::service::get_stream instead")]
    pub fn get_stream(&self, uuid: String, stream_id: i64) -> DataBytes {
        self::peer::service::get_stream(uuid, stream_id)
    }
    #[deprecated(note = "use api::peer::service::init instead")]
    pub fn init(&self) -> DataObject {
        self::peer::service::init()
    }
    #[deprecated(note = "use api::peer::service::listen instead")]
    pub fn listen(&self, ipaddr: String, port: i64) -> i64 {
        self::peer::service::listen(ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::listen_udp instead")]
    pub fn listen_udp(&self, ipaddr: String, port: i64) -> i64 {
        self::peer::service::listen_udp(ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::maintenance instead")]
    pub fn maintenance(&self) -> String {
        self::peer::service::maintenance()
    }
    #[deprecated(note = "use api::peer::service::new_stream instead")]
    pub fn new_stream(&self, uuid: String) -> i64 {
        self::peer::service::new_stream(uuid)
    }
    #[deprecated(note = "use api::peer::service::session_expire instead")]
    pub fn session_expire(&self, user: DataObject) -> DataObject {
        self::peer::service::session_expire(user)
    }
    #[deprecated(note = "use api::peer::service::stream_write instead")]
    pub fn stream_write(&self, uuid: String, stream_id: i64, data: DataBytes) -> bool {
        self::peer::service::stream_write(uuid, stream_id, data)
    }
    #[deprecated(note = "use api::peer::service::tcp_connect instead")]
    pub fn tcp_connect(&self, uuid: String, ipaddr: String, port: i64) -> bool {
        self::peer::service::tcp_connect(uuid, ipaddr, port)
    }
    #[deprecated(note = "use api::peer::service::udp_connect instead")]
    pub fn udp_connect(&self, ipaddr: String, port: i64) -> DataObject {
        self::peer::service::udp_connect(ipaddr, port)
    }
}
impl old_security_security {
    #[deprecated(note = "use api::security::security::current_user instead")]
    pub fn current_user(&self, nn_sessionid: String) -> DataObject {
        self::security::security::current_user(nn_sessionid)
    }
    #[deprecated(note = "use api::security::security::deleteuser instead")]
    pub fn deleteuser(&self, id: String) -> String {
        self::security::security::deleteuser(id)
    }
    #[deprecated(note = "use api::security::security::groups instead")]
    pub fn groups(&self) -> DataArray {
        self::security::security::groups()
    }
    #[deprecated(note = "use api::security::security::init instead")]
    pub fn init(&self) -> DataObject {
        self::security::security::init()
    }
    #[deprecated(note = "use api::security::security::setuser instead")]
    pub fn setuser(&self, id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
        self::security::security::setuser(id, displayname, password, groups, keepalive, address, port)
    }
    #[deprecated(note = "use api::security::security::users instead")]
    pub fn users(&self) -> DataObject {
        self::security::security::users()
    }
}
