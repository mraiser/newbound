pub mod peer;
pub mod security;
pub mod dev;
pub mod app;

use std::env;
use flowlang::appserver::*;
use flowlang::rustcmd::*;

fn main() {
  flowlang::init("data");
  init_cmds();

  env::set_var("RUST_BACKTRACE", "1");
  {
    run();
  }
}

fn init_cmds(){
    RustCmd::add("lvvzvn183bd066566j4".to_string(), peer::service::session_expire::execute, "".to_string());
    RustCmd::add("gloivk183adf03115od".to_string(), peer::service::udp_connect::execute, "".to_string());
    RustCmd::add("rgxowg183ad6b7a12u6".to_string(), peer::service::listen_udp::execute, "".to_string());
    RustCmd::add("tkwkml18390d46728m8".to_string(), peer::peer::info::execute, "".to_string());
    RustCmd::add("ywokvt1838c110d92l8".to_string(), peer::peer::peers::execute, "".to_string());
    RustCmd::add("nmojwg18386b2f0d2n2".to_string(), peer::service::exec::execute, "".to_string());
    RustCmd::add("ltnpiq18385ba6cc7u3".to_string(), peer::service::tcp_connect::execute, "".to_string());
    RustCmd::add("rjntml18385b15b5ch0".to_string(), peer::service::maintenance::execute, "".to_string());
    RustCmd::add("grvupm18379e9a159n8".to_string(), peer::service::init::execute, "".to_string());
    RustCmd::add("irxuhn18379cef5bcp4".to_string(), peer::service::listen::execute, "".to_string());
    RustCmd::add("jszjgy1836bfe023ckc".to_string(), security::security::deleteuser::execute, "".to_string());
    RustCmd::add("soqxoo1836bb51d5dy2".to_string(), security::security::setuser::execute, "".to_string());
    RustCmd::add("qjmvtm1836b1bc850o9".to_string(), security::security::groups::execute, "".to_string());
    RustCmd::add("ysnihn1836b0814aen5".to_string(), security::security::users::execute, "".to_string());
    RustCmd::add("yvktsi1836b070c6dz2".to_string(), security::security::users::execute, "".to_string());
    RustCmd::add("huwgsg1836a850ba8w3".to_string(), security::security::init::execute, "".to_string());
    RustCmd::add("jypyqw1836795f8fbn2".to_string(), app::app::deviceid::execute, "".to_string());
    RustCmd::add("kgkxpw183664f5554q4".to_string(), app::util::hash::execute, "".to_string());
    RustCmd::add("thtpku18366290644p4".to_string(), app::util::init::execute, "".to_string());
    RustCmd::add("iwvgmq1835bb194ffo8".to_string(), dev::editcontrol::publishapp::execute, "".to_string());
    RustCmd::add("gjssly1834862d5acg37d9".to_string(), dev::dev::compile::execute, "".to_string());
    RustCmd::add("guuqrj1836147b650zd".to_string(), app::util::zip::execute, "".to_string());
    RustCmd::add("spjvvp183568021f1o2".to_string(), app::app::timeron::execute, "".to_string());
    RustCmd::add("hompli1835678a4efz2".to_string(), app::app::timeroff::execute, "".to_string());
    RustCmd::add("wlnoru18350ecc36cr4".to_string(), app::app::eventon::execute, "".to_string());
    RustCmd::add("xrysgt18350cb35cet3".to_string(), app::app::eventoff::execute, "".to_string());
    RustCmd::add("spumvi1834c2cf1e6t2".to_string(), app::app::events::execute, "".to_string());
    RustCmd::add("mhnrjq18347bcd5f7t27".to_string(), app::app::delete::execute, "".to_string());
    RustCmd::add("ynpmir183479da2b9r25f8".to_string(), app::app::unique_session_id::execute, "".to_string());
    RustCmd::add("hkgorn1834268eb07k1406".to_string(), app::app::deletelib::execute, "".to_string());
    RustCmd::add("vtnluk1834262fb3fl137e".to_string(), app::app::libs::execute, "".to_string());
    RustCmd::add("stskpj183421d8115xd3f".to_string(), app::app::newlib::execute, "".to_string());
    RustCmd::add("vsxqui18332a86185i159".to_string(), dev::editcontrol::appdata::execute, "".to_string());
    RustCmd::add("uirppm183059f5a37z1b0c".to_string(), app::app::assets::execute, "".to_string());
    RustCmd::add("yjjxqk18303e75f8atb5a".to_string(), app::app::write::execute, "".to_string());
    RustCmd::add("nsjjvk18303d7b2bdra53".to_string(), app::app::write::execute, "".to_string());
    RustCmd::add("gttrqg18303bc96c9w898".to_string(), app::app::uninstall::execute, "".to_string());
    RustCmd::add("knhvsn182f9997b1dxd04".to_string(), app::app::settings::execute, "".to_string());
    RustCmd::add("ynjjnl182f0c30c2ej26bb".to_string(), app::app::apps::execute, "".to_string());
    RustCmd::add("zmzwjn182ee9c7f0ar314".to_string(), app::app::jsapi::execute, "".to_string());
    RustCmd::add("tsmxsj182ee9ac271o2f3".to_string(), app::app::remembersession::execute, "".to_string());
    RustCmd::add("ztizvj182ee99186cp2d2".to_string(), app::app::login::execute, "".to_string());
    RustCmd::add("thoxjp182ee8eaebdt225".to_string(), app::app::exec::execute, "".to_string());
    RustCmd::add("hxusrn182ebab0fc8o1102".to_string(), app::app::asset::execute, "".to_string());
    RustCmd::add("nyzimq182eabf7339p7c5".to_string(), app::app::read::execute, "".to_string());
}
