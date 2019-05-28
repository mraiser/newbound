package com.newbound.net.mime;

import java.io.*;
import java.util.*;

import com.newbound.robot.BotUtil;

public class MIMEHeader extends BotUtil
{
	protected static Properties mMimeTypes = new Properties();
	static
	{
		mMimeTypes.setProperty(".3dm", "x-world/x-3dmf");
		mMimeTypes.setProperty(".3dmf", "x-world/x-3dmf");
		mMimeTypes.setProperty(".a", "application/octet-stream");
		mMimeTypes.setProperty(".aab", "application/x-authorware-bin");
		mMimeTypes.setProperty(".aam", "application/x-authorware-map");
		mMimeTypes.setProperty(".aas", "application/x-authorware-seg");
		mMimeTypes.setProperty(".abc", "text/vnd.abc");
		mMimeTypes.setProperty(".acgi", "text/html");
		mMimeTypes.setProperty(".afl", "video/animaflex");
		mMimeTypes.setProperty(".ai", "application/postscript");
		mMimeTypes.setProperty(".aif", "audio/aiff");
		mMimeTypes.setProperty(".aifc", "audio/aiff");
		mMimeTypes.setProperty(".aiff", "audio/aiff");
		mMimeTypes.setProperty(".aim", "application/x-aim");
		mMimeTypes.setProperty(".aip", "text/x-audiosoft-intra");
		mMimeTypes.setProperty(".ani", "application/x-navi-animation");
		mMimeTypes.setProperty(".aos", "application/x-nokia-9000-communicator-add-on-software");
		mMimeTypes.setProperty(".aps", "application/mime");
		mMimeTypes.setProperty(".arc", "application/octet-stream");
		mMimeTypes.setProperty(".arj", "application/arj");
		mMimeTypes.setProperty(".art", "image/x-jg");
		mMimeTypes.setProperty(".asf", "video/x-ms-asf");
		mMimeTypes.setProperty(".asm", "text/x-asm");
		mMimeTypes.setProperty(".asp", "text/asp");
		mMimeTypes.setProperty(".asx", "application/x-mplayer2");
		mMimeTypes.setProperty(".au", "audio/basic");
		mMimeTypes.setProperty(".avi", "video/x-msvideo");
		mMimeTypes.setProperty(".avs", "video/avs-video");
		mMimeTypes.setProperty(".bcpio", "application/x-bcpio");
		mMimeTypes.setProperty(".bin", "application/mac-binary");
		mMimeTypes.setProperty(".bm", "image/bmp");
		mMimeTypes.setProperty(".bmp", "image/bmp");
		mMimeTypes.setProperty(".boo", "application/book");
		mMimeTypes.setProperty(".book", "application/book");
		mMimeTypes.setProperty(".boz", "application/x-bzip2");
		mMimeTypes.setProperty(".bsh", "application/x-bsh");
		mMimeTypes.setProperty(".bz", "application/x-bzip");
		mMimeTypes.setProperty(".bz2", "application/x-bzip2");
		mMimeTypes.setProperty(".c", "text/plain");
		mMimeTypes.setProperty(".c++", "text/plain");
		mMimeTypes.setProperty(".cat", "application/vnd.ms-pki.seccat");
		mMimeTypes.setProperty(".cc", "text/plain");
		mMimeTypes.setProperty(".ccad", "application/clariscad");
		mMimeTypes.setProperty(".cco", "application/x-cocoa");
		mMimeTypes.setProperty(".cdf", "application/cdf");
		mMimeTypes.setProperty(".cer", "application/pkix-cert");
		mMimeTypes.setProperty(".cha", "application/x-chat");
		mMimeTypes.setProperty(".chat", "application/x-chat");
		mMimeTypes.setProperty(".class", "application/java");
		mMimeTypes.setProperty(".com", "application/octet-stream");
		mMimeTypes.setProperty(".conf", "text/plain");
		mMimeTypes.setProperty(".cpio", "application/x-cpio");
		mMimeTypes.setProperty(".cpp", "text/x-c");
		mMimeTypes.setProperty(".cpt", "application/mac-compactpro");
		mMimeTypes.setProperty(".crl", "application/pkcs-crl");
		mMimeTypes.setProperty(".crt", "application/pkix-cert");
		mMimeTypes.setProperty(".csh", "application/x-csh");
		mMimeTypes.setProperty(".css", "text/css");
		mMimeTypes.setProperty(".cxx", "text/plain");
		mMimeTypes.setProperty(".dcr", "application/x-director");
		mMimeTypes.setProperty(".deepv", "application/x-deepv");
		mMimeTypes.setProperty(".def", "text/plain");
		mMimeTypes.setProperty(".der", "application/x-x509-ca-cert");
		mMimeTypes.setProperty(".dif", "video/x-dv");
		mMimeTypes.setProperty(".dir", "application/x-director");
		mMimeTypes.setProperty(".dl", "video/dl");
		mMimeTypes.setProperty(".doc", "application/msword");
		mMimeTypes.setProperty(".dot", "application/msword");
		mMimeTypes.setProperty(".dp", "application/commonground");
		mMimeTypes.setProperty(".drw", "application/drafting");
		mMimeTypes.setProperty(".dump", "application/octet-stream");
		mMimeTypes.setProperty(".dv", "video/x-dv");
		mMimeTypes.setProperty(".dvi", "application/x-dvi");
		mMimeTypes.setProperty(".dwf", "drawing/x-dwf (old)");
		mMimeTypes.setProperty(".dwg", "application/acad");
		mMimeTypes.setProperty(".dxf", "application/dxf");
		mMimeTypes.setProperty(".dxr", "application/x-director");
		mMimeTypes.setProperty(".el", "text/x-script.elisp");
		mMimeTypes.setProperty(".elc", "application/x-bytecode.elisp (compiled elisp)");
		mMimeTypes.setProperty(".env", "application/x-envoy");
		mMimeTypes.setProperty(".eps", "application/postscript");
		mMimeTypes.setProperty(".es", "application/x-esrehber");
		mMimeTypes.setProperty(".etx", "text/x-setext");
		mMimeTypes.setProperty(".evy", "application/envoy");
		mMimeTypes.setProperty(".exe", "application/octet-stream");
		mMimeTypes.setProperty(".f", "text/plain");
		mMimeTypes.setProperty(".f77", "text/x-fortran");
		mMimeTypes.setProperty(".f90", "text/plain");
		mMimeTypes.setProperty(".fdf", "application/vnd.fdf");
		mMimeTypes.setProperty(".fif", "application/fractals");
		mMimeTypes.setProperty(".fli", "video/fli");
		mMimeTypes.setProperty(".flo", "image/florian");
		mMimeTypes.setProperty(".flx", "text/vnd.fmi.flexstor");
		mMimeTypes.setProperty(".fmf", "video/x-atomic3d-feature");
		mMimeTypes.setProperty(".for", "text/plain");
		mMimeTypes.setProperty(".fpx", "image/vnd.fpx");
		mMimeTypes.setProperty(".frl", "application/freeloader");
		mMimeTypes.setProperty(".funk", "audio/make");
		mMimeTypes.setProperty(".g", "text/plain");
		mMimeTypes.setProperty(".g3", "image/g3fax");
		mMimeTypes.setProperty(".gif", "image/gif");
		mMimeTypes.setProperty(".gl", "video/gl");
		mMimeTypes.setProperty(".gsd", "audio/x-gsm");
		mMimeTypes.setProperty(".gsm", "audio/x-gsm");
		mMimeTypes.setProperty(".gsp", "application/x-gsp");
		mMimeTypes.setProperty(".gss", "application/x-gss");
		mMimeTypes.setProperty(".gtar", "application/x-gtar");
		mMimeTypes.setProperty(".gz", "application/x-compressed");
		mMimeTypes.setProperty(".gzip", "application/x-gzip");
		mMimeTypes.setProperty(".h", "text/plain");
		mMimeTypes.setProperty(".hdf", "application/x-hdf");
		mMimeTypes.setProperty(".help", "application/x-helpfile");
		mMimeTypes.setProperty(".hgl", "application/vnd.hp-hpgl");
		mMimeTypes.setProperty(".hh", "text/plain");
		mMimeTypes.setProperty(".hlb", "text/x-script");
		mMimeTypes.setProperty(".hlp", "application/hlp");
		mMimeTypes.setProperty(".hpg", "application/vnd.hp-hpgl");
		mMimeTypes.setProperty(".hpgl", "application/vnd.hp-hpgl");
		mMimeTypes.setProperty(".hqx", "application/binhex");
		mMimeTypes.setProperty(".hta", "application/hta");
		mMimeTypes.setProperty(".htc", "text/x-component");
		mMimeTypes.setProperty(".htm", "text/html");
		mMimeTypes.setProperty(".html", "text/html");
		mMimeTypes.setProperty(".htmls", "text/html");
		mMimeTypes.setProperty(".htt", "text/webviewhtml");
		mMimeTypes.setProperty(".htx", "text/html");
		mMimeTypes.setProperty(".ice", "x-conference/x-cooltalk");
		mMimeTypes.setProperty(".ico", "image/x-icon");
		mMimeTypes.setProperty(".idc", "text/plain");
		mMimeTypes.setProperty(".ief", "image/ief");
		mMimeTypes.setProperty(".iefs", "image/ief");
		mMimeTypes.setProperty(".iges", "application/iges");
		mMimeTypes.setProperty(".igs", "application/iges");
		mMimeTypes.setProperty(".ima", "application/x-ima");
		mMimeTypes.setProperty(".imap", "application/x-httpd-imap");
		mMimeTypes.setProperty(".inf", "application/inf");
		mMimeTypes.setProperty(".ins", "application/x-internett-signup");
		mMimeTypes.setProperty(".ip", "application/x-ip2");
		mMimeTypes.setProperty(".isu", "video/x-isvideo");
		mMimeTypes.setProperty(".it", "audio/it");
		mMimeTypes.setProperty(".iv", "application/x-inventor");
		mMimeTypes.setProperty(".ivr", "i-world/i-vrml");
		mMimeTypes.setProperty(".ivy", "application/x-livescreen");
		mMimeTypes.setProperty(".jam", "audio/x-jam");
		mMimeTypes.setProperty(".jav", "text/plain");
		mMimeTypes.setProperty(".jar", "application/java-archive");
		mMimeTypes.setProperty(".java", "text/plain");
		mMimeTypes.setProperty(".jcm", "application/x-java-commerce");
		mMimeTypes.setProperty(".jfif", "image/jpeg");
		mMimeTypes.setProperty(".jfif-tbnl", "image/jpeg");
		mMimeTypes.setProperty(".jnlp", "application/x-java-jnlp-file");
		mMimeTypes.setProperty(".jpe", "image/jpeg");
		mMimeTypes.setProperty(".jpeg", "image/jpeg");
		mMimeTypes.setProperty(".jpg", "image/jpeg");
		mMimeTypes.setProperty(".jps", "image/x-jps");
		mMimeTypes.setProperty(".js", "application/x-javascript");
		mMimeTypes.setProperty(".jut", "image/jutvision");
		mMimeTypes.setProperty(".kar", "audio/midi");
		mMimeTypes.setProperty(".ksh", "application/x-ksh");
		mMimeTypes.setProperty(".la", "audio/nspaudio");
		mMimeTypes.setProperty(".lam", "audio/x-liveaudio");
		mMimeTypes.setProperty(".latex", "application/x-latex");
		mMimeTypes.setProperty(".lha", "application/lha");
		mMimeTypes.setProperty(".lhx", "application/octet-stream");
		mMimeTypes.setProperty(".list", "text/plain");
		mMimeTypes.setProperty(".lma", "audio/nspaudio");
		mMimeTypes.setProperty(".log", "text/plain");
		mMimeTypes.setProperty(".lsp", "application/x-lisp");
		mMimeTypes.setProperty(".lst", "text/plain");
		mMimeTypes.setProperty(".lsx", "text/x-la-asf");
		mMimeTypes.setProperty(".ltx", "application/x-latex");
		mMimeTypes.setProperty(".lzh", "application/octet-stream");
		mMimeTypes.setProperty(".lzx", "application/lzx");
		mMimeTypes.setProperty(".m", "text/plain");
		mMimeTypes.setProperty(".m1v", "video/mpeg");
		mMimeTypes.setProperty(".m2a", "audio/mpeg");
		mMimeTypes.setProperty(".m2v", "video/mpeg");
		mMimeTypes.setProperty(".m3u", "audio/x-mpequrl");
		mMimeTypes.setProperty(".man", "application/x-troff-man");
		mMimeTypes.setProperty(".map", "application/x-navimap");
		mMimeTypes.setProperty(".mar", "text/plain");
		mMimeTypes.setProperty(".mbd", "application/mbedlet");
		mMimeTypes.setProperty(".mc$", "application/x-magic-cap-package-1.0");
		mMimeTypes.setProperty(".mcd", "application/mcad");
		mMimeTypes.setProperty(".mcf", "image/vasa");
		mMimeTypes.setProperty(".mcp", "application/netmc");
		mMimeTypes.setProperty(".me", "application/x-troff-me");
		mMimeTypes.setProperty(".mht", "message/rfc822");
		mMimeTypes.setProperty(".mhtml", "message/rfc822");
		mMimeTypes.setProperty(".mid", "application/x-midi");
		mMimeTypes.setProperty(".midi", "application/x-midi");
		mMimeTypes.setProperty(".mif", "application/x-frame");
		mMimeTypes.setProperty(".mime", "message/rfc822");
		mMimeTypes.setProperty(".mjf", "audio/x-vnd.audioexplosion.mjuicemediafile");
		mMimeTypes.setProperty(".mjpg", "video/x-motion-jpeg");
		mMimeTypes.setProperty(".mm", "application/base64");
		mMimeTypes.setProperty(".mme", "application/base64");
		mMimeTypes.setProperty(".mod", "audio/mod");
		mMimeTypes.setProperty(".moov", "video/quicktime");
		mMimeTypes.setProperty(".mov", "video/quicktime");
		mMimeTypes.setProperty(".movie", "video/x-sgi-movie");
		mMimeTypes.setProperty(".mp2", "audio/mpeg");
		mMimeTypes.setProperty(".mp3", "audio/mp3");
		mMimeTypes.setProperty(".m4a", "audio/m4a");
		mMimeTypes.setProperty(".mp4", "video/mp4");
		mMimeTypes.setProperty(".mpa", "audio/mpeg");
		mMimeTypes.setProperty(".mpc", "application/x-project");
		mMimeTypes.setProperty(".mpe", "video/mpeg");
		mMimeTypes.setProperty(".mpeg", "video/mpeg");
		mMimeTypes.setProperty(".mpg", "audio/mpeg");
		mMimeTypes.setProperty(".mpga", "audio/mpeg");
		mMimeTypes.setProperty(".mpp", "application/vnd.ms-project");
		mMimeTypes.setProperty(".mpt", "application/x-project");
		mMimeTypes.setProperty(".mpv", "application/x-project");
		mMimeTypes.setProperty(".mpx", "application/x-project");
		mMimeTypes.setProperty(".mrc", "application/marc");
		mMimeTypes.setProperty(".ms", "application/x-troff-ms");
		mMimeTypes.setProperty(".mv", "video/x-sgi-movie");
		mMimeTypes.setProperty(".my", "audio/make");
		mMimeTypes.setProperty(".mzz", "application/x-vnd.audioexplosion.mzz");
		mMimeTypes.setProperty(".nap", "image/naplps");
		mMimeTypes.setProperty(".naplps", "image/naplps");
		mMimeTypes.setProperty(".nc", "application/x-netcdf");
		mMimeTypes.setProperty(".ncm", "application/vnd.nokia.configuration-message");
		mMimeTypes.setProperty(".nif", "image/x-niff");
		mMimeTypes.setProperty(".niff", "image/x-niff");
		mMimeTypes.setProperty(".nix", "application/x-mix-transfer");
		mMimeTypes.setProperty(".nsc", "application/x-conference");
		mMimeTypes.setProperty(".nvd", "application/x-navidoc");
		mMimeTypes.setProperty(".o", "application/octet-stream");
		mMimeTypes.setProperty(".oda", "application/oda");
		mMimeTypes.setProperty(".omc", "application/x-omc");
		mMimeTypes.setProperty(".omcd", "application/x-omcdatamaker");
		mMimeTypes.setProperty(".omcr", "application/x-omcregerator");
		mMimeTypes.setProperty(".p", "text/x-pascal");
		mMimeTypes.setProperty(".p10", "application/pkcs10");
		mMimeTypes.setProperty(".p12", "application/pkcs-12");
		mMimeTypes.setProperty(".p7a", "application/x-pkcs7-signature");
		mMimeTypes.setProperty(".p7c", "application/pkcs7-mime");
		mMimeTypes.setProperty(".p7m", "application/pkcs7-mime");
		mMimeTypes.setProperty(".p7r", "application/x-pkcs7-certreqresp");
		mMimeTypes.setProperty(".p7s", "application/pkcs7-signature");
		mMimeTypes.setProperty(".part", "application/pro_eng");
		mMimeTypes.setProperty(".pas", "text/pascal");
		mMimeTypes.setProperty(".pbm", "image/x-portable-bitmap");
		mMimeTypes.setProperty(".pcl", "application/vnd.hp-pcl");
		mMimeTypes.setProperty(".pct", "image/x-pict");
		mMimeTypes.setProperty(".pcx", "image/x-pcx");
		mMimeTypes.setProperty(".pdb", "chemical/x-pdb");
		mMimeTypes.setProperty(".pdf", "application/pdf");
		mMimeTypes.setProperty(".pfunk", "audio/make");
		mMimeTypes.setProperty(".pgm", "image/x-portable-graymap");
		mMimeTypes.setProperty(".pic", "image/pict");
		mMimeTypes.setProperty(".pict", "image/pict");
		mMimeTypes.setProperty(".pkg", "application/x-newton-compatible-pkg");
		mMimeTypes.setProperty(".pko", "application/vnd.ms-pki.pko");
		mMimeTypes.setProperty(".pl", "text/plain");
		mMimeTypes.setProperty(".plx", "application/x-pixclscript");
		mMimeTypes.setProperty(".pm", "image/x-xpixmap");
		mMimeTypes.setProperty(".pm4", "application/x-pagemaker");
		mMimeTypes.setProperty(".pm5", "application/x-pagemaker");
		mMimeTypes.setProperty(".png", "image/png");
		mMimeTypes.setProperty(".pnm", "application/x-portable-anymap");
		mMimeTypes.setProperty(".pot", "application/mspowerpoint");
		mMimeTypes.setProperty(".pov", "model/x-pov");
		mMimeTypes.setProperty(".ppa", "application/vnd.ms-powerpoint");
		mMimeTypes.setProperty(".ppm", "image/x-portable-pixmap");
		mMimeTypes.setProperty(".pps", "application/mspowerpoint");
		mMimeTypes.setProperty(".ppt", "application/mspowerpoint");
		mMimeTypes.setProperty(".ppz", "application/mspowerpoint");
		mMimeTypes.setProperty(".pre", "application/x-freelance");
		mMimeTypes.setProperty(".prt", "application/pro_eng");
		mMimeTypes.setProperty(".ps", "application/postscript");
		mMimeTypes.setProperty(".psd", "application/octet-stream");
		mMimeTypes.setProperty(".pvu", "paleovu/x-pv");
		mMimeTypes.setProperty(".pwz", "application/vnd.ms-powerpoint");
		mMimeTypes.setProperty(".py", "text/x-script.phyton");
		mMimeTypes.setProperty(".pyc", "applicaiton/x-bytecode.python");
		mMimeTypes.setProperty(".qcp", "audio/vnd.qcelp");
		mMimeTypes.setProperty(".qd3", "x-world/x-3dmf");
		mMimeTypes.setProperty(".qd3d", "x-world/x-3dmf");
		mMimeTypes.setProperty(".qif", "image/x-quicktime");
		mMimeTypes.setProperty(".qt", "video/quicktime");
		mMimeTypes.setProperty(".qtc", "video/x-qtc");
		mMimeTypes.setProperty(".qti", "image/x-quicktime");
		mMimeTypes.setProperty(".qtif", "image/x-quicktime");
		mMimeTypes.setProperty(".ra", "audio/x-pn-realaudio");
		mMimeTypes.setProperty(".ram", "audio/x-pn-realaudio");
		mMimeTypes.setProperty(".ras", "application/x-cmu-raster");
		mMimeTypes.setProperty(".rast", "image/cmu-raster");
		mMimeTypes.setProperty(".rexx", "text/x-script.rexx");
		mMimeTypes.setProperty(".rf", "image/vnd.rn-realflash");
		mMimeTypes.setProperty(".rgb", "image/x-rgb");
		mMimeTypes.setProperty(".rm", "application/vnd.rn-realmedia");
		mMimeTypes.setProperty(".rmi", "audio/mid");
		mMimeTypes.setProperty(".rmm", "audio/x-pn-realaudio");
		mMimeTypes.setProperty(".rmp", "audio/x-pn-realaudio");
		mMimeTypes.setProperty(".rng", "application/ringing-tones");
		mMimeTypes.setProperty(".rnx", "application/vnd.rn-realplayer");
		mMimeTypes.setProperty(".roff", "application/x-troff");
		mMimeTypes.setProperty(".rp", "image/vnd.rn-realpix");
		mMimeTypes.setProperty(".rpm", "audio/x-pn-realaudio-plugin");
		mMimeTypes.setProperty(".rt", "text/richtext");
		mMimeTypes.setProperty(".rtf", "application/rtf");
		mMimeTypes.setProperty(".rtx", "application/rtf");
		mMimeTypes.setProperty(".rv", "video/vnd.rn-realvideo");
		mMimeTypes.setProperty(".s", "text/x-asm");
		mMimeTypes.setProperty(".s3m", "audio/s3m");
		mMimeTypes.setProperty(".saveme", "application/octet-stream");
		mMimeTypes.setProperty(".sbk", "application/x-tbook");
		mMimeTypes.setProperty(".scm", "application/x-lotusscreencam");
		mMimeTypes.setProperty(".sdml", "text/plain");
		mMimeTypes.setProperty(".sdp", "application/sdp");
		mMimeTypes.setProperty(".sdr", "application/sounder");
		mMimeTypes.setProperty(".sea", "application/sea");
		mMimeTypes.setProperty(".set", "application/set");
		mMimeTypes.setProperty(".sgm", "text/sgml");
		mMimeTypes.setProperty(".sgml", "text/sgml");
		mMimeTypes.setProperty(".sh", "application/x-bsh");
		mMimeTypes.setProperty(".shar", "application/x-bsh");
		mMimeTypes.setProperty(".shtml", "text/html");
		mMimeTypes.setProperty(".sid", "audio/x-psid");
		mMimeTypes.setProperty(".sit", "application/x-sit");
		mMimeTypes.setProperty(".skd", "application/x-koan");
		mMimeTypes.setProperty(".skm", "application/x-koan");
		mMimeTypes.setProperty(".skp", "application/x-koan");
		mMimeTypes.setProperty(".skt", "application/x-koan");
		mMimeTypes.setProperty(".sl", "application/x-seelogo");
		mMimeTypes.setProperty(".smi", "application/smil");
		mMimeTypes.setProperty(".smil", "application/smil");
		mMimeTypes.setProperty(".snd", "audio/basic");
		mMimeTypes.setProperty(".sol", "application/solids");
		mMimeTypes.setProperty(".spc", "application/x-pkcs7-certificates");
		mMimeTypes.setProperty(".spl", "application/futuresplash");
		mMimeTypes.setProperty(".spr", "application/x-sprite");
		mMimeTypes.setProperty(".sprite", "application/x-sprite");
		mMimeTypes.setProperty(".src", "application/x-wais-source");
		mMimeTypes.setProperty(".ssi", "text/x-server-parsed-html");
		mMimeTypes.setProperty(".ssm", "application/streamingmedia");
		mMimeTypes.setProperty(".sst", "application/vnd.ms-pki.certstore");
		mMimeTypes.setProperty(".step", "application/step");
		mMimeTypes.setProperty(".stl", "application/sla");
		mMimeTypes.setProperty(".stp", "application/step");
		mMimeTypes.setProperty(".sv4cpio", "application/x-sv4cpio");
		mMimeTypes.setProperty(".sv4crc", "application/x-sv4crc");
		mMimeTypes.setProperty(".svf", "image/vnd.dwg");
		mMimeTypes.setProperty(".svg", "image/svg+xml");
		mMimeTypes.setProperty(".svr", "application/x-world");
		mMimeTypes.setProperty(".swf", "application/x-shockwave-flash");
		mMimeTypes.setProperty(".t", "application/x-troff");
		mMimeTypes.setProperty(".talk", "text/x-speech");
		mMimeTypes.setProperty(".tar", "application/x-tar");
		mMimeTypes.setProperty(".tbk", "application/toolbook");
		mMimeTypes.setProperty(".tcl", "application/x-tcl");
		mMimeTypes.setProperty(".tcsh", "text/x-script.tcsh");
		mMimeTypes.setProperty(".tex", "application/x-tex");
		mMimeTypes.setProperty(".texi", "application/x-texinfo");
		mMimeTypes.setProperty(".texinfo", "application/x-texinfo");
		mMimeTypes.setProperty(".text", "application/plain");
		mMimeTypes.setProperty(".tgz", "application/gnutar");
		mMimeTypes.setProperty(".tif", "image/tiff");
		mMimeTypes.setProperty(".tiff", "image/tiff");
		mMimeTypes.setProperty(".tr", "application/x-troff");
		mMimeTypes.setProperty(".tsi", "audio/tsp-audio");
		mMimeTypes.setProperty(".tsp", "application/dsptype");
		mMimeTypes.setProperty(".tsv", "text/tab-separated-values");
		mMimeTypes.setProperty(".turbot", "image/florian");
		mMimeTypes.setProperty(".txt", "text/plain");
		mMimeTypes.setProperty(".uil", "text/x-uil");
		mMimeTypes.setProperty(".uni", "text/uri-list");
		mMimeTypes.setProperty(".unis", "text/uri-list");
		mMimeTypes.setProperty(".unv", "application/i-deas");
		mMimeTypes.setProperty(".uri", "text/uri-list");
		mMimeTypes.setProperty(".uris", "text/uri-list");
		mMimeTypes.setProperty(".ustar", "application/x-ustar");
		mMimeTypes.setProperty(".uu", "application/octet-stream");
		mMimeTypes.setProperty(".uue", "text/x-uuencode");
		mMimeTypes.setProperty(".vcd", "application/x-cdlink");
		mMimeTypes.setProperty(".vcs", "text/x-vcalendar");
		mMimeTypes.setProperty(".vda", "application/vda");
		mMimeTypes.setProperty(".vdo", "video/vdo");
		mMimeTypes.setProperty(".vew", "application/groupwise");
		mMimeTypes.setProperty(".viv", "video/vivo");
		mMimeTypes.setProperty(".vivo", "video/vivo");
		mMimeTypes.setProperty(".vmd", "application/vocaltec-media-desc");
		mMimeTypes.setProperty(".vmf", "application/vocaltec-media-file");
		mMimeTypes.setProperty(".voc", "audio/voc");
		mMimeTypes.setProperty(".vos", "video/vosaic");
		mMimeTypes.setProperty(".vox", "audio/voxware");
		mMimeTypes.setProperty(".vqe", "audio/x-twinvq-plugin");
		mMimeTypes.setProperty(".vqf", "audio/x-twinvq");
		mMimeTypes.setProperty(".vql", "audio/x-twinvq-plugin");
		mMimeTypes.setProperty(".vrml", "application/x-vrml");
		mMimeTypes.setProperty(".vrt", "x-world/x-vrt");
		mMimeTypes.setProperty(".vsd", "application/x-visio");
		mMimeTypes.setProperty(".vst", "application/x-visio");
		mMimeTypes.setProperty(".vsw", "application/x-visio");
		mMimeTypes.setProperty(".w60", "application/wordperfect6.0");
		mMimeTypes.setProperty(".w61", "application/wordperfect6.1");
		mMimeTypes.setProperty(".w6w", "application/msword");
		mMimeTypes.setProperty(".wav", "audio/wav");
		mMimeTypes.setProperty(".wb1", "application/x-qpro");
		mMimeTypes.setProperty(".wbmp", "image/vnd.wap.wbmp");
		mMimeTypes.setProperty(".web", "application/vnd.xara");
		mMimeTypes.setProperty(".wiz", "application/msword");
		mMimeTypes.setProperty(".wk1", "application/x-123");
		mMimeTypes.setProperty(".wmf", "windows/metafile");
		mMimeTypes.setProperty(".wml", "text/vnd.wap.wml");
		mMimeTypes.setProperty(".wmlc", "application/vnd.wap.wmlc");
		mMimeTypes.setProperty(".wmls", "text/vnd.wap.wmlscript");
		mMimeTypes.setProperty(".wmlsc", "application/vnd.wap.wmlscriptc");
		mMimeTypes.setProperty(".word", "application/msword");
		mMimeTypes.setProperty(".wp", "application/wordperfect");
		mMimeTypes.setProperty(".wp5", "application/wordperfect");
		mMimeTypes.setProperty(".wp6", "application/wordperfect");
		mMimeTypes.setProperty(".wpd", "application/wordperfect");
		mMimeTypes.setProperty(".wq1", "application/x-lotus");
		mMimeTypes.setProperty(".wri", "application/mswrite");
		mMimeTypes.setProperty(".wrl", "application/x-world");
		mMimeTypes.setProperty(".wrz", "model/vrml");
		mMimeTypes.setProperty(".wsc", "text/scriplet");
		mMimeTypes.setProperty(".wsrc", "application/x-wais-source");
		mMimeTypes.setProperty(".wtk", "application/x-wintalk");
		mMimeTypes.setProperty(".x-png", "image/png");
		mMimeTypes.setProperty(".xbm", "image/x-xbitmap");
		mMimeTypes.setProperty(".xdr", "video/x-amt-demorun");
		mMimeTypes.setProperty(".xgz", "xgl/drawing");
		mMimeTypes.setProperty(".xif", "image/vnd.xiff");
		mMimeTypes.setProperty(".xl", "application/excel");
		mMimeTypes.setProperty(".xla", "application/excel");
		mMimeTypes.setProperty(".xlb", "application/excel");
		mMimeTypes.setProperty(".xlc", "application/excel");
		mMimeTypes.setProperty(".xld", "application/excel");
		mMimeTypes.setProperty(".xlk", "application/excel");
		mMimeTypes.setProperty(".xll", "application/excel");
		mMimeTypes.setProperty(".xlm", "application/excel");
		mMimeTypes.setProperty(".xls", "application/excel");
		mMimeTypes.setProperty(".xlt", "application/excel");
		mMimeTypes.setProperty(".xlv", "application/excel");
		mMimeTypes.setProperty(".xlw", "application/excel");
		mMimeTypes.setProperty(".xm", "audio/xm");
		mMimeTypes.setProperty(".xml", "application/xml");
		mMimeTypes.setProperty(".xmz", "xgl/movie");
		mMimeTypes.setProperty(".xpix", "application/x-vnd.ls-xpix");
		mMimeTypes.setProperty(".xpm", "image/x-xpixmap");
		mMimeTypes.setProperty(".xsr", "video/x-amt-showrun");
		mMimeTypes.setProperty(".xwd", "image/x-xwd");
		mMimeTypes.setProperty(".xyz", "chemical/x-pdb");
		mMimeTypes.setProperty(".z", "application/x-compress");
		mMimeTypes.setProperty(".zip", "application/x-compressed");
		mMimeTypes.setProperty(".zoo", "application/octet-stream");
		mMimeTypes.setProperty(".zsh", "text/x-script.zsh");
		mMimeTypes.setProperty(".wsdl", "application/xml");
	}

    protected Hashtable mHeaders = new Hashtable();

    interface LineReader
    {
        public String readLine() throws IOException;
    }
    
    public MIMEHeader(BufferedInputStream br) throws IOException
    {
        final BufferedInputStream lrbr = br;
        LineReader lr = new LineReader()
        {
            public String readLine() throws IOException { return MIMEHeader.readLine(lrbr, 2048); }
        };
        
        parse(lr);
    }
    
    public MIMEHeader(MIMEMultipart mm) throws IOException
    {
        final MIMEMultipart lrmm = mm;
        LineReader lr = new LineReader()
        {
            public String readLine() throws IOException 
            {
            	byte[][] holder = { null };
            	lrmm.readLine(holder);
            	return holder[0] == null ? null : new String(holder[0]);
        	}
        };
        
        parse(lr);
    }
    
    private void parse(LineReader lr) throws IOException
    {
// System.out.println("Parsing Header");

        String headerName = null;
        String headerValue = null;
        String oneline;
        
        int chances = 0;

        while (true)
        {
            oneline = lr.readLine();
//          System.out.println(oneline);

            if (oneline == null)
            {
                // Shouldn't happen! Either Malformed Header or blocking I/O
                if (chances++ == 40) break;
                try { Thread.sleep(500); }
                catch (Exception x) {}
            }
            else if (oneline.trim().equals("")) break;
            else
            {
                if (oneline.startsWith(" ") || oneline.startsWith("\t"))
                {
                    if (headerName == null) 
                    	throw new IOException("Malformed MIME Data");
                    headerValue += "\r\n" + oneline;
                }
                else
                {
                    int i = oneline.indexOf(":");
                    if (i == -1) i = oneline.indexOf("=");
                    if (i == -1)
                    {
                    	System.out.println("BAD MIME ROW: "+oneline);
//                    	throw new IOException("Malformed MIME Data");
                    }
                    else
                    {
	                    headerName = oneline.substring(0,i);
	                    headerValue = oneline.substring(i+1).trim();
                    }
                }
                
                mHeaders.put(headerName.toUpperCase(), headerValue);
            }
        }
    }

    public static Hashtable parse(MIMEMultipart mm) throws IOException
    {
        return new MIMEHeader(mm).getHeaders();
    }

    public Hashtable getHeaders()
    {
        return mHeaders;
    }
    
	public static String lookupMimeType(String file)
	{
		int i = file.lastIndexOf('.');
		if (i == -1) return null;
		
		String s = file.substring(i).toLowerCase();
		return mMimeTypes.getProperty(s);
	}

}