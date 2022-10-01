pub mod peer;
pub mod security;
pub mod dev;
pub mod app;
use flowlang::rustcmd::*;

#[derive(Debug)]
pub struct Initializer {
    pub data_ref: (&'static str, (((usize,usize),(usize,usize)),((usize,usize),(usize,usize)),((usize,usize),(usize,usize)))),
    pub cmds: Vec<(String, Transform, String)>,
}

#[no_mangle]
pub fn mirror(state: &mut Initializer) {
    flowlang::mirror(state.data_ref);
    state.cmds.clear();
    state.cmds.push(("tkwkml18390d46728m8".to_string(), peer::peer::info::execute, "".to_string()));
    state.cmds.push(("ywokvt1838c110d92l8".to_string(), peer::peer::peers::execute, "".to_string()));
    state.cmds.push(("nmojwg18386b2f0d2n2".to_string(), peer::service::exec::execute, "".to_string()));
    state.cmds.push(("ltnpiq18385ba6cc7u3".to_string(), peer::service::tcp_connect::execute, "".to_string()));
    state.cmds.push(("rjntml18385b15b5ch0".to_string(), peer::service::maintenance::execute, "".to_string()));
    state.cmds.push(("grvupm18379e9a159n8".to_string(), peer::service::init::execute, "".to_string()));
    state.cmds.push(("irxuhn18379cef5bcp4".to_string(), peer::service::listen::execute, "".to_string()));
    state.cmds.push(("jszjgy1836bfe023ckc".to_string(), security::security::deleteuser::execute, "".to_string()));
    state.cmds.push(("soqxoo1836bb51d5dy2".to_string(), security::security::setuser::execute, "".to_string()));
    state.cmds.push(("qjmvtm1836b1bc850o9".to_string(), security::security::groups::execute, "".to_string()));
    state.cmds.push(("ysnihn1836b0814aen5".to_string(), security::security::users::execute, "".to_string()));
    state.cmds.push(("yvktsi1836b070c6dz2".to_string(), security::security::users::execute, "".to_string()));
    state.cmds.push(("huwgsg1836a850ba8w3".to_string(), security::security::init::execute, "".to_string()));
    state.cmds.push(("jypyqw1836795f8fbn2".to_string(), app::app::deviceid::execute, "".to_string()));
    state.cmds.push(("kgkxpw183664f5554q4".to_string(), app::util::hash::execute, "".to_string()));
    state.cmds.push(("thtpku18366290644p4".to_string(), app::util::init::execute, "".to_string()));
    state.cmds.push(("iwvgmq1835bb194ffo8".to_string(), dev::editcontrol::publishapp::execute, "".to_string()));
    state.cmds.push(("gjssly1834862d5acg37d9".to_string(), dev::dev::compile::execute, "".to_string()));
    state.cmds.push(("guuqrj1836147b650zd".to_string(), app::util::zip::execute, "".to_string()));
    state.cmds.push(("spjvvp183568021f1o2".to_string(), app::app::timeron::execute, "".to_string()));
    state.cmds.push(("hompli1835678a4efz2".to_string(), app::app::timeroff::execute, "".to_string()));
    state.cmds.push(("wlnoru18350ecc36cr4".to_string(), app::app::eventon::execute, "".to_string()));
    state.cmds.push(("xrysgt18350cb35cet3".to_string(), app::app::eventoff::execute, "".to_string()));
    state.cmds.push(("spumvi1834c2cf1e6t2".to_string(), app::app::events::execute, "".to_string()));
    state.cmds.push(("mhnrjq18347bcd5f7t27".to_string(), app::app::delete::execute, "".to_string()));
    state.cmds.push(("ynpmir183479da2b9r25f8".to_string(), app::app::unique_session_id::execute, "".to_string()));
    state.cmds.push(("hkgorn1834268eb07k1406".to_string(), app::app::deletelib::execute, "".to_string()));
    state.cmds.push(("vtnluk1834262fb3fl137e".to_string(), app::app::libs::execute, "".to_string()));
    state.cmds.push(("stskpj183421d8115xd3f".to_string(), app::app::newlib::execute, "".to_string()));
    state.cmds.push(("vsxqui18332a86185i159".to_string(), dev::editcontrol::appdata::execute, "".to_string()));
    state.cmds.push(("uirppm183059f5a37z1b0c".to_string(), app::app::assets::execute, "".to_string()));
    state.cmds.push(("yjjxqk18303e75f8atb5a".to_string(), app::app::write::execute, "".to_string()));
    state.cmds.push(("nsjjvk18303d7b2bdra53".to_string(), app::app::write::execute, "".to_string()));
    state.cmds.push(("gttrqg18303bc96c9w898".to_string(), app::app::uninstall::execute, "".to_string()));
    state.cmds.push(("knhvsn182f9997b1dxd04".to_string(), app::app::settings::execute, "".to_string()));
    state.cmds.push(("ynjjnl182f0c30c2ej26bb".to_string(), app::app::apps::execute, "".to_string()));
    state.cmds.push(("zmzwjn182ee9c7f0ar314".to_string(), app::app::jsapi::execute, "".to_string()));
    state.cmds.push(("tsmxsj182ee9ac271o2f3".to_string(), app::app::remembersession::execute, "".to_string()));
    state.cmds.push(("ztizvj182ee99186cp2d2".to_string(), app::app::login::execute, "".to_string()));
    state.cmds.push(("thoxjp182ee8eaebdt225".to_string(), app::app::exec::execute, "".to_string()));
    state.cmds.push(("hxusrn182ebab0fc8o1102".to_string(), app::app::asset::execute, "".to_string()));
    state.cmds.push(("nyzimq182eabf7339p7c5".to_string(), app::app::read::execute, "".to_string()));
    for q in &state.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
}
