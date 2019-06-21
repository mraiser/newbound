package com.newbound.util;

import com.newbound.robot.BotBase;
/*
 * Copyright (c) 2011, 2012, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */
import com.sun.javafx.tools.packager.*;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Vector;

import javax.imageio.ImageIO;

import org.json.JSONArray;
import org.json.JSONObject;

// NOTE: Modified to remove System.exit calls, bundle and arguments
public class JavaPackager {
	
	public static JSONObject pack(JSONObject data) throws Exception 
	{
		BotBase metabot = BotBase.getBot("metabot");
		{
		  File pack = new File(metabot.getRootDir(), "build");
		  pack = new File(pack, "package");
		  pack = new File(pack, "macosx");
		  pack.mkdirs();

		  String name = data.getString("name");
		  String iconimg = data.getString("icon");

		  String info = "<?xml version=\"1.0\" ?><!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\"><plist version=\"1.0\"><dict><key>LSMinimumSystemVersion</key><string>10.7.4</string><key>CFBundleDevelopmentRegion</key><string>English</string><key>CFBundleAllowMixedLocalizations</key><true/><key>CFBundleExecutable</key><string>"+name+"</string><key>CFBundleIconFile</key><string>"+name+".icns</string><key>CFBundleIdentifier</key><string>NativeStartup</string><key>CFBundleInfoDictionaryVersion</key><string>6.0</string><key>CFBundleName</key><string>"+name+"</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleSignature</key><string>????</string><!-- See http://developer.apple.com/library/mac/#releasenotes/General/SubmittingToMacAppStore/_index.htmlfor list of AppStore categories --><key>LSApplicationCategoryType</key><string>Unknown</string><key>CFBundleVersion</key><string>1.0</string><key>NSHumanReadableCopyright</key><string>Copyright (C) 2018</string><key>NSHighResolutionCapable</key><string>true</string></dict></plist>";

		  File f = new File(pack, "Info.plist");
		  metabot.writeFile(f, info.getBytes());

		  String script = "tell application \"Finder\"\r  tell disk \""+name+"\"\r    open\r    set current view of container window to icon view\r    set toolbar visible of container window to false\r    set statusbar visible of container window to false\r\r    -- size of window should match size of background\r    set the bounds of container window to {400, 100, 917, 370}\r\r    set theViewOptions to the icon view options of container window\r    set arrangement of theViewOptions to not arranged\r    set icon size of theViewOptions to 128\r    set background picture of theViewOptions to file \".background:background.png\"\r\r    -- Create alias for install location\r    make new alias file at container window to POSIX file \"/Applications\" with properties {name:\"Applications\"}\r\r    set allTheFiles to the name of every item of container window\r    repeat with theFile in allTheFiles\r      set theFilePath to POSIX Path of theFile\r      if theFilePath is \"/"+name+".app\"\r        -- Position application location\r        set position of item theFile of container window to {120, 135}\r      else if theFilePath is \"/Applications\"\r        -- Position install location\r        set position of item theFile of container window to {390, 135}\r      else\r        -- Move all other files far enough to be not visible if user has \"show hidden files\" option set\r        set position of item theFile of container window to {1000, 0}\r      end\r    end repeat\r\r    close\r    open\r    update without registering applications\r    delay 5\r  end tell\rend tell\r\r";

		  f = new File(pack, name+"-dmg-setup.scpt");
		  metabot.writeFile(f, script.getBytes());

		  File img = new File(metabot.getRootDir(), "src");
		  img = new File(img, "html");
		  img = new File(img, "metabot");
		  img = new File(img, "img");
		  img = new File(img, "DMG-background.png");
		  metabot.copyFile(img, new File(pack, name+"-background.png"));

		  img = new File(img.getParentFile(), "icon-square-app-builder.png");
		  try
		  {
		    int i = iconimg.indexOf(':');
		    String lib = iconimg.substring(0,i);
		    String icon = iconimg.substring(i+1);
		    File img2 = new File(metabot.getRootDir().getParentFile().getParentFile(), "data");
		    img2 = new File(img2, lib);
		    img2 = new File(img2, "_ASSETS");
		    img2 = new File(img2, icon);
		    if (img2.exists()) img = img2;
		  }
		  catch (Exception x) {}

		  BufferedImage icon = ImageIO.read(img);
		  File icns = new File(pack, name+".icns");

		  BufferedImage bi = new BufferedImage(512, 512, BufferedImage.TYPE_INT_ARGB );
		  Graphics2D g = bi.createGraphics();

		  int x = 0;
		  int y = 0;
		  int w = icon.getWidth();
		  int h = icon.getHeight();
		  double r = (double)w/(double)h;

		  if (w>h)
		  {
		    h = (int)(512 / r);
		    w = 512;
		    x = 0;
		    y = (w - h)/2;
		  }
		  else 
		  {
		    w = (int)(512 * r);
		    h = 512;
		    y = 0;
		    x = (h - w)/2;
		  }

		  g.drawImage(icon, x, y, w, h, null);
		  g.dispose();
		  File outputfile = new File(pack, "temp000.png");
		  File tempfile = new File(pack, "temp000.tiff");
		  ImageIO.write(bi, "png", outputfile);
		  metabot.systemCall(new String[]{ "sips", "-s", "format", "tiff", 
		          outputfile.getCanonicalPath(),"--out", tempfile.getCanonicalPath() });  
		  File apaga2 = new File(pack, "temp000.png");
		  apaga2.delete();
		  metabot.systemCall(new String[]{ "tiff2icns", "-noLarge", 
		          tempfile.getCanonicalPath(), icns.getAbsolutePath()});
		  File apaga = new File(pack, "temp000.tiff");
		  apaga.delete();

		  File icns2 = new File(pack, name+"-volume.icns");
		  metabot.copyFile(icns, icns2);
		}

		File src = metabot.getRootDir().getParentFile().getParentFile(); 
		File dst = metabot.newTempFile();
		dst.mkdirs();

		JSONArray libja = data.getJSONArray("libs");
		int n = libja.length();
		String[] libs = new String[n];
		while (n-->0) libs[n] = libja.getString(n);

		JSONArray appja = data.getJSONArray("apps");
		n = appja.length();
		String[] apps = new String[n];
		while (n-->0) apps[n] = appja.getString(n);

		String d = data.getString("default");
		int port = data.getInt("port");
		Installer.build(src, dst, libs, apps, d, port);

		d = data.getString("name");

		File f = new File(metabot.getRootDir(), "html");
		f.mkdirs();
		File zip = new File(f, d+".zip");
		FileOutputStream fos = new FileOutputStream(zip);
		metabot.zipDir(dst, fos);
		fos.close();

		JSONObject jo2 = new JSONObject();
		jo2.put("jar", "../metabot/"+d+".zip");

		if (data.has("native") && data.getBoolean("native"))
		{
		  File build = new File(metabot.getRootDir(), "build");
		  File bin = new File(build, "bin");
		  File jar = new File(build, "jar");
		  File dist = new File(build, "dist");
		  src = new File(build, "src");
		  File srcsrc = new File(src, "src");
		  bin.mkdirs();
		  dist.mkdirs();
		  dst.renameTo(src);
		  
		//  String[] javac = { "javac", "-d", bin.getCanonicalPath(), "" };
		//  javac[3] = new File(srcsrc, "NativeStartup.java").getCanonicalPath();
		//  metabot.systemCall(javac);
		  
		  Vector<File> srcdirs = new Vector<>();
		  srcdirs.addElement(srcsrc);
		  CompilingClassLoader ccl = new CompilingClassLoader(Publisher.class.getClassLoader(), srcdirs, bin);
		  ccl.compileClass("NativeStartup");
		  
		  metabot.copyFile(zip, new File(bin, "src.zip"));
		  
		//  String[] javac = new String[] { "javapackager", "-createjar", "-appclass", "NativeStartup", "-outdir", jar.getCanonicalPath(), "-outfile", "newbound.jar", "-srcdir", bin.getCanonicalPath() };
		//  metabot.systemCall(javac);
		  String[] javac = new String[] { "-createjar", "-appclass", "NativeStartup", "-outdir", jar.getCanonicalPath(), "-outfile", "newbound.jar", "-srcdir", bin.getCanonicalPath() };
		  new JavaPackager().main(javac);

		  String javaHome = System.getProperty("java.home");
		  File home = new File(javaHome).getParentFile();
		  File lib = new File(home, "lib");
		  
		  File icon = new File(build, "package");
		  icon = new File(icon, "macosx");
		  icon = new File(icon, d+".icns");
		  
		//  javac = new String[] { "javapackager", "-deploy", "-Bruntime="+home.getCanonicalPath(), "-Bicon="+icon.getCanonicalPath(), "-native", "image", "-outdir", dist.getCanonicalPath(), "-outfile", d, "-srcdir", jar.getCanonicalPath(), "-srcfiles", "newbound.jar", "-appclass", "NativeStartup", "-name", d, "-title", d, "-vendor", "Newbound, Inc." };
		//  String[] out = metabot.systemCall(javac);
		//  System.out.println("=====================================================================================");
		//  System.out.println(out[0]);
		//  System.out.println(out[1]);
		//  System.out.println("=====================================================================================");
		  javac = new String[] { "-deploy", "-Bruntime="+home.getCanonicalPath(), "-Bicon="+icon.getCanonicalPath(), "-native", "image", "-outdir", dist.getCanonicalPath(), "-outfile", d, "-srcdir", jar.getCanonicalPath(), "-srcfiles", "newbound.jar", "-appclass", "NativeStartup", "-name", d, "-title", d, "-vendor", "Newbound, Inc." };
		  new JavaPackager().main(javac);
		  
		  File applib = new File(dist, "bundles");
		  applib = new File(applib, d+".app");
		  applib = new File(applib, "Contents");
		  applib = new File(applib, "PlugIns");
		  applib = new File(applib, "Java.runtime");
		  applib = new File(applib, "Contents");
		  applib = new File(applib, "Home");
		  applib = new File(applib, "lib");
		  
		  metabot.copyFolder(lib, applib);
		  
		  File app = new File(dist, "bundles");
		  zip = new File(f, d+".app.zip");
		  fos = new FileOutputStream(zip);
		  metabot.zipDir(app, fos);
		  fos.close();
		  
		  metabot.deleteDir(build);
		  jo2.put("app", "../metabot/"+d+".app.zip");
		}
		else metabot.deleteDir(dst);

		return jo2;
	}


//    private final ResourceBundle bundle =
//            ResourceBundle.getBundle("com/sun/javafx/tools/packager/Bundle");

    private final String version = "Java Packager version " + PackagerLib.JAVAFX_VERSION + "\n";
    private final String help = "No help is available, sorry";

    private String nextArg(String args[], int i) {
        return (i == args.length - 1) ? "" : args[i + 1];
    }

    private boolean verbose = false;
    private boolean packageAsJar = false;
    private boolean genJNLP = false;
    private boolean css2Bin = false;
    private boolean signJar = false;
    private boolean makeAll = false;

    private void addResources(CommonParams commonParams,
                                     File baseDir, String s) {
        if (s == null || "".equals(s)) {
            return;
        }

        String[] pathArray = s.split(File.pathSeparator);

        for (final String path: pathArray) {
            commonParams.addResource(baseDir, path);
        }
    }
/*
 * Arguments are not visible.
 * 
    private void addArgument(DeployParams deployParams, String argument) {
        if (deployParams.arguments != null) {
            deployParams.arguments.add(argument);
        } else {
            List<String> list = new LinkedList<String>();
            list.add(argument);
            deployParams.setArguments(list);
        }
    }

    private void addArgument(CreateJarParams deployParams, String argument) {
        if (deployParams.arguments != null) {
            deployParams.arguments.add(argument);
        } else {
            List<String> list = new LinkedList<String>();
            list.add(argument);
            deployParams.setArguments(list);
        }
    }
*/
    private Map<String, String> createAttrMap(String arg) {
        Map<String, String> map = new HashMap<String, String>();
        if (arg == null || "".equals(arg)) {
            return null;
        }
        String[] pairsArray = arg.split(",");
        for (String pair: pairsArray) {
            String[] attr = pair.split("=");
            map.put(attr[0].trim(), attr[1].trim());
        }
        return map;
    }

    private List<Param> parseParams(String filename) throws IOException {
        File paramFile = new File(filename);
        Properties properties = new Properties();
        FileInputStream in = new FileInputStream(paramFile);
        properties.load(in);
        in.close();

        List<Param> parameters = new ArrayList<Param>(properties.size());

        if (properties != null) {
            for (Map.Entry en : properties.entrySet()) {
                Param p = new Param();
                p.setName((String)en.getKey());
                p.setValue((String)en.getValue());
                parameters.add(p);
            }
        }
        return parameters;
    }

    private List<HtmlParam> parseHtmlParams(String filename) throws IOException {
        File paramFile = new File(filename);
        Properties properties = new Properties();
        FileInputStream in = new FileInputStream(paramFile);
        properties.load(in);
        in.close();

        List<HtmlParam> parameters = new ArrayList<HtmlParam>(properties.size());

        if (properties != null) {
            for (Map.Entry en : properties.entrySet()) {
                HtmlParam p = new HtmlParam();
                p.setName((String)en.getKey());
                p.setValue((String)en.getValue());
                parameters.add(p);
            }
        }
        return parameters;
    }

    private List<com.sun.javafx.tools.ant.Callback> parseCallbacks(String param) {
        String[] callbacks = param.split(",");
        List<com.sun.javafx.tools.ant.Callback> list = new ArrayList<com.sun.javafx.tools.ant.Callback>(callbacks.length);

        for (String cb: callbacks) {
            String[] nameCmd = cb.split(":");
            if (nameCmd.length == 2) {
                list.add(new com.sun.javafx.tools.ant.Callback(nameCmd[0], nameCmd[1]));
            }
        }
        return list;
    }

    public void main(String args[]) throws Exception {
        if (args.length == 0 || args.length == 1 && args[0].equals("-help")) {
            System.out.println(help);
        } else if (args.length == 1 && args[0].equals("-version")) {
            System.out.println(version);
        } else {
            PackagerLib packager = new PackagerLib();
            CreateJarParams createJarParams = new CreateJarParams();
            DeployParams deployParams = new DeployParams();
            CreateBSSParams createBssParams = new CreateBSSParams();
            SignJarParams signJarParams = new SignJarParams();
            MakeAllParams makeAllParams = new MakeAllParams();

            File srcdir = null;
            try {
                if (args[0].equalsIgnoreCase("-createjar")) {
                    boolean srcfilesSet = false;
                    for (int i = 1; i < args.length; i++) {
                        String arg = args[i];
                        if (arg.equalsIgnoreCase("-appclass")) {
                            createJarParams.setApplicationClass(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-preloader")) {
                            createJarParams.setPreloader(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-classpath")) {
                            createJarParams.setClasspath(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-manifestAttrs")) {
                            createJarParams.setManifestAttrs(createAttrMap(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-noembedlauncher")) {
                            createJarParams.setEmbedLauncher(false);
                        } else if (arg.equalsIgnoreCase("-nocss2bin")) {
                            createJarParams.setCss2bin(false);
                        } else if (arg.equalsIgnoreCase("-runtimeVersion")) {
                            createJarParams.setFxVersion(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-verbose") || arg.equalsIgnoreCase("-v")) {
                            createJarParams.setVerbose(true);
                            verbose = true;
                        } else if (arg.equalsIgnoreCase("-outdir")) {
                            createJarParams.setOutdir(new File(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-outfile")) {
                            createJarParams.setOutfile(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcdir")) {
                            srcdir = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcfiles")) {
                            addResources(createJarParams, srcdir, nextArg(args, i++));
                            srcfilesSet = true;
                        } else if (arg.equalsIgnoreCase("-argument")) {
//                            addArgument(createJarParams, nextArg(args, i++));
                        	nextArg(args, i++);
                        }  else if (arg.equalsIgnoreCase("-paramFile")) {
                            createJarParams.setParams(parseParams(nextArg(args, i++)));
                        }
                    }
                    if (!srcfilesSet) {
                        //using "." as default dir is confusing. Require explicit list of inputs
                        if (srcdir == null) {
                            throw new PackagerException("ERR_MissingArgument", "-srcfiles (-srcdir)");
                        }
                        addResources(createJarParams, srcdir, ".");
                    }
                    packageAsJar = true;

                } else if (args[0].equalsIgnoreCase("-deploy")) {
                    boolean srcfilesSet = false;
                    File templateInFile = null;
                    File templateOutFile = null;

                    //can only set it to true with command line, reset default
                    deployParams.setEmbedJNLP(false);
                    for (int i = 1; i < args.length; i++) {
                        String arg = args[i];
                        if (arg.equalsIgnoreCase("-title")) {
                            deployParams.setTitle(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-vendor")) {
                            deployParams.setVendor(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-native")) {
                            //if no argument is provided we will treat it as ALL
                            // for compatibility with FX 2.2
                        	com.sun.javafx.tools.packager.bundlers.Bundler.BundleType type = com.sun.javafx.tools.packager.bundlers.Bundler.BundleType.ALL;
                            String format = null; //null means ANY
                            if (i+1 < args.length && !args[i+1].startsWith("-")) {
                                String v = args[i+1];
                                //parsing logic is the same as in DeployFXTask
                                if ("image".equals(v)) {
                                    type = com.sun.javafx.tools.packager.bundlers.Bundler.BundleType.IMAGE;
                                } else if ("installer".equals(v)) {
                                    type = com.sun.javafx.tools.packager.bundlers.Bundler.BundleType.INSTALLER;
                                } else {
                                    //assume it is request to build only specific format
                                    // (like exe or msi)
                                    type = com.sun.javafx.tools.packager.bundlers.Bundler.BundleType.INSTALLER;
                                    format = (v != null) ? v.toLowerCase() : null;
                                }
                            }
                            deployParams.setBundleType(type);
                            deployParams.setTargetFormat(format);
                        } else if (arg.equalsIgnoreCase("-description")) {
                            deployParams.setDescription(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-appclass")) {
                            deployParams.setApplicationClass(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-preloader")) {
                            deployParams.setPreloader(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-paramFile")) {
                            deployParams.setParams(parseParams(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-htmlParamFile")) {
                            deployParams.setHtmlParams(parseHtmlParams(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-width")) {
                            deployParams.setWidth(Integer.parseInt(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-height")) {
                            deployParams.setHeight(Integer.parseInt(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-name")) {
                            deployParams.setAppName(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-embedJNLP")) {
                            deployParams.setEmbedJNLP(true);
                        } else if (arg.equalsIgnoreCase("-embedCertificates")) {
                            deployParams.setEmbedCertifcates(true);
                        } else if (arg.equalsIgnoreCase("-allpermissions")) {
                            deployParams.setAllPermissions(true);
                        } else if (arg.equalsIgnoreCase("-updatemode")) {
                            deployParams.setUpdateMode(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-isExtension")) {
                            deployParams.setExtension(true);
                        } else if (arg.equalsIgnoreCase("-callbacks")) {
                            deployParams.setCallbacks(parseCallbacks(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-templateInFilename")) {
                            templateInFile = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-templateOutFilename")) {
                            templateOutFile = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-appId")) {
                            deployParams.setAppId(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-verbose") || arg.equalsIgnoreCase("-v")) {
                            deployParams.setVerbose(true);
                            verbose = true;
                        } else if (arg.equalsIgnoreCase("-includedt")) {
                            deployParams.setIncludeDT(true);
                        } else if (arg.equalsIgnoreCase("-outdir")) {
                            deployParams.setOutdir(new File(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-outfile")) {
                            deployParams.setOutfile(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcdir")) {
                            srcdir = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcfiles")) {
                            addResources(deployParams, srcdir, nextArg(args, i++));
                            srcfilesSet = true;
                        } else if (arg.equalsIgnoreCase("-argument")) {
//                            addArgument(deployParams, nextArg(args, i++));
                            nextArg(args, i++);
                        }
                        // added because this is based on an old version that doesn't have it
                        else if (arg.startsWith("-Bicon=")) {
                        	deployParams.addIcon( arg.substring(7), null, -1, -1, -1, DeployParams.RunMode.ALL );
                        }
                    }
                    if (templateInFile != null) {
                        deployParams.addTemplate(templateInFile, templateOutFile);
                    }
                    if (!srcfilesSet) {
                        //using "." as default dir is confusing. Require explicit list of inputs
                        if (srcdir == null) {
                            throw new PackagerException("ERR_MissingArgument", "-srcfiles (-srcdir)");
                        }
                        addResources(deployParams, srcdir, ".");
                    }
                    genJNLP = true;
                } else if (args[0].equalsIgnoreCase("-createbss")) {
                    boolean srcfilesSet = false;
                    for (int i = 1; i < args.length; i++) {
                        String arg = args[i];
                        if (arg.equalsIgnoreCase("-verbose") || arg.equalsIgnoreCase("-v")) {
                            createBssParams.setVerbose(true);
                            verbose = true;
                        } else if (arg.equalsIgnoreCase("-outdir")) {
                            createBssParams.setOutdir(new File(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-srcdir")) {
                            srcdir = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcfiles")) {
                            addResources(createBssParams, srcdir, nextArg(args, i++));
                            srcfilesSet = true;
                        }
                    }
                    if (!srcfilesSet) {
                        //using "." as default dir is confusing. Require explicit list of inputs
                        if (srcdir == null) {
                            throw new PackagerException("ERR_MissingArgument", "-srcfiles (-srcdir)");
                        }
                        addResources(createBssParams, srcdir, ".");
                    }
                    css2Bin = true;

                } else if (args[0].equalsIgnoreCase("-signJar")) {
                    boolean srcfilesSet = false;
                    for (int i = 1; i < args.length; i++) {
                        String arg = args[i];
                        if (arg.equalsIgnoreCase("-keyStore")) {
                            signJarParams.setKeyStore(new File(nextArg(args, i++)));
                        } else if(arg.equalsIgnoreCase("-alias")) {
                            signJarParams.setAlias(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-storePass")) {
                            signJarParams.setStorePass(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-keyPass")) {
                            signJarParams.setKeyPass(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-storeType")) {
                            signJarParams.setStoreType(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-verbose") || arg.equalsIgnoreCase("-v")) {
                            signJarParams.setVerbose(true);
                            verbose = true;
                        } else if (arg.equalsIgnoreCase("-outdir")) {
                            signJarParams.setOutdir(new File(nextArg(args, i++)));
                        } else if (arg.equalsIgnoreCase("-srcdir")) {
                            srcdir = new File(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-srcfiles")) {
                            addResources(signJarParams, srcdir, nextArg(args, i++));
                            srcfilesSet = true;
                        }
                    }
                    if (!srcfilesSet) {
                        //using "." as default dir is confusing. Require explicit list of inputs
                        if (srcdir == null) {
                            throw new PackagerException("ERR_MissingArgument", "-srcfiles (-srcdir)");
                        }
                        addResources(signJarParams, srcdir, ".");
                    }
                    signJar = true;
                } else if (args[0].equalsIgnoreCase("-makeall")) {
                    for (int i = 1; i < args.length; i++) {
                        String arg = args[i];
                        if (arg.equalsIgnoreCase("-appclass")) {
                            makeAllParams.setAppClass(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-preloader")) {
                            makeAllParams.setPreloader(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-classpath")) {
                            makeAllParams.setClasspath(nextArg(args, i++));
                        } else if (arg.equalsIgnoreCase("-name")) {
                            makeAllParams.setAppName(nextArg(args, i++));
                        } else if(arg.equalsIgnoreCase("-width")) {
                            makeAllParams.setWidth(Integer.parseInt(nextArg(args, i++)));
                        } else if(arg.equalsIgnoreCase("-height")) {
                            makeAllParams.setHeight(Integer.parseInt(nextArg(args, i++)));
                        } else if(arg.equalsIgnoreCase("-v")) {
                            makeAllParams.setVerbose(true);
                        }
                    }
                    makeAll = true;
                } else {
                	throw new Exception(MessageFormat.format(
                                        "Error: Unknown command: {0}",
                                        args[0]));
                }

                //set default logger
                if (verbose) {
                    Log.setLogger(new Log.Logger(true));
                } else {
                    Log.setLogger(new Log.Logger(false));
                }

                if (css2Bin) {
                    createBssParams.validate();
                    packager.generateBSS(createBssParams);
                }
                if (packageAsJar) {
                    createJarParams.validate();
                    packager.packageAsJar(createJarParams);
                }
                if (genJNLP) {
                    deployParams.validate();
                    packager.generateDeploymentPackages(deployParams);
                }
                if (signJar) {
                    signJarParams.validate();
                    packager.signJar(signJarParams);
                }
                if (makeAll) {
                    makeAllParams.validate();
                    packager.makeAll(makeAllParams);
                }

            } catch (Exception e) {
                if (verbose) {
                    throw e;
                } else {
                	throw new Exception(e.getMessage());
                }
            }
        }
    }
}