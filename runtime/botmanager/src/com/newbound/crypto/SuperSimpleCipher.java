package com.newbound.crypto;

import java.math.BigInteger;
import java.security.Key;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Random;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.SecretKey;
import javax.crypto.spec.DHParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.newbound.robot.BotUtil;

public class SuperSimpleCipher
{
	private static String KEYPAIRALGO = "DiffieHellman";
	private static String DIGEST = "SHA-256";
	
	private static final String ALGO = "AES/ECB/PKCS5PADDING";
//	private static final String ALGO = "DES/CBC/PKCS5Padding";
	private static final String ALGOSHORT = "AES";
//	private static final String ALGOSHORT = "DES";
	public static final int KEYSIZE = 16;
	
	private static final Random mRandom = new Random();
	 
	private byte[] secret = null;
	private Cipher mCipher = null;
	
	private Object MUTEX = new Object();
	
	// Create either an encoder or decoder using the given shared secret
	public SuperSimpleCipher(byte[] source, boolean write) throws Exception
	{
		super();
	    secret = source;
		Key key = generateKey();
	    mCipher = Cipher.getInstance(ALGO);
	    mCipher.init(write ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, key);
	}
	
	private Key generateKey() throws Exception {
	    Key key = new SecretKeySpec(secret, ALGOSHORT);
	    return key;
	}
	
	public SuperSimpleCipher(byte[] prkey, byte[] pbkey, boolean write) throws Exception
	{
		KeyFactory kf = KeyFactory.getInstance(KEYPAIRALGO);
		
		X509EncodedKeySpec kspb = new X509EncodedKeySpec(pbkey);
		PublicKey pbk = kf.generatePublic(kspb);

		PKCS8EncodedKeySpec kspr = new PKCS8EncodedKeySpec(prkey);
		PrivateKey prk = kf.generatePrivate(kspr);

		 mCipher = Cipher.getInstance(ALGO);
		 SecretKey key = agreeSecretKey(prk, pbk, true);
		 mCipher.init(write ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, key);
	}
	
	private static SecretKey agreeSecretKey(PrivateKey prk_self, PublicKey pbk_peer, boolean lastPhase) throws Exception 
	{
        KeyAgreement ka = KeyAgreement.getInstance(KEYPAIRALGO);
        ka.init(prk_self);
        ka.doPhase(pbk_peer, lastPhase);
        byte[] secret = ka.generateSecret();
        MessageDigest sha256 = MessageDigest.getInstance(DIGEST); 
        byte[] bkey = Arrays.copyOf(sha256.digest(secret), KEYSIZE);

        SecretKey desSpec = new SecretKeySpec(bkey, ALGOSHORT);
        return desSpec;
    }
	
	public static KeyPair generateKeyPairX() throws NoSuchAlgorithmException
	{
		KeyPairGenerator kpg = KeyPairGenerator.getInstance(KEYPAIRALGO);
		return kpg.generateKeyPair();
	}

	public static KeyPair generateKeyPair() throws Exception
	{
		KeyPairGenerator kpg = KeyPairGenerator.getInstance(KEYPAIRALGO);
		
//        final BigInteger p = new BigInteger("f460d489678f7ec903293517e9193fd156c821b3e2b027c644eb96aedc85a54c971468cea07df15e9ecda0e2ca062161add38b9aa8aefcbd7ac18cd05a6bfb1147aaa516a6df694ee2cb5164607c618df7c65e75e274ff49632c34ce18da534ee32cfc42279e0f4c29101e89033130058d7f77744dddaca541094f19c394d485", 16);
//        final BigInteger g = new BigInteger("9ce2e29b2be0ebfd7b3c58cfb0ee4e9004e65367c069f358effaf2a8e334891d20ff158111f54b50244d682b720f964c4d6234079d480fcc2ce66e0fa3edeb642b0700cd62c4c02a483c92d2361e41a23706332bd3a8aaed07fe53bba376cefbce12fa46265ad5ea5210a3d96f5260f7b6f29588f61a4798e40bdc75bbb2b457", 16);
//        final int l = 1023;

        final BigInteger p = new BigInteger("178011905478542266528237562450159990145232156369120674273274450314442865788737020770612695252123463079567156784778466449970650770920727857050009668388144034129745221171818506047231150039301079959358067395348717066319802262019714966524135060945913707594956514672855690606794135837542707371727429551343320695239");
        final BigInteger g = new BigInteger("174068207532402095185811980123523436538604490794561350978495831040599953488455823147851597408940950725307797094915759492368300574252438761037084473467180148876118103083043754985190983472601550494691329488083395492313850000361646482644608492304078721818959999056496097769368017749273708962006689187956744210730");
        final int l = 512;

        final DHParameterSpec dhSpec = new DHParameterSpec(p, g, l);
        kpg.initialize(dhSpec);
        
		return kpg.generateKeyPair();
	}
	
	public static byte randomByte()
	{
		return (byte) mRandom.nextInt(32);
	}

	public static byte[] getSeed(int i)
	{
		byte[] ba = new byte[i];
		mRandom.nextBytes(ba);
		return ba;
	}

	public static byte[] generateSeed(int n)
	{
		return getSeed(n);
	}
	
	public static byte[] intToBytes(int val)
	{
	       byte[] b = new byte[4];
	        for (int i = 0; i < 4; i++) {
	            int offset = (b.length - 1 - i) * 8;
	            b[i] = (byte) ((val >>> offset) & 0xFF);
	        }
	        return b;
    }

	public static int bytesToInt(byte[] b, int offset)
	{
        int value = 0;
        for (int i = 0; i < 4; i++) {
            int shift = (4 - 1 - i) * 8;
            value += (b[i + offset] & 0x000000FF) << shift;
        }
        return value;
    }

	public  byte[] encrypt(byte[] in) throws Exception
	{
		synchronized (MUTEX) { return mCipher.doFinal(in); }
	}

	public  byte[] encrypt(byte[] in, int off, int len) throws Exception
	{
		synchronized (MUTEX) { return mCipher.doFinal(in, off, len); }
	}

	public byte[] decrypt(byte[] in) throws Exception
	{
		synchronized (MUTEX) { return mCipher.doFinal(in); }
	}
	
	public byte[] decrypt(byte[] in, int off, int len) throws Exception
	{
//		System.out.println("["+in.length+"/"+off+"/"+len+"]");
		synchronized (MUTEX) { return mCipher.doFinal(in, off, len); }
	}
	
	public static void main(String[] args)
	{
		try
		{
			// Shared Secret
//			byte[] ba = getSeed(KEYSIZE);
//			System.out.println(BotUtil.toHexString(ba));
			byte[] ba = BotUtil.fromHexString("b56fc308b12c3c27602a3c40f35b0e51");
					

			// Text to encrypt
			String s = "I am the very model of a modern major general";
			
			// create Encoder and Decoder pair using shared secret
			SuperSimpleCipher ssc1 = new SuperSimpleCipher(ba, true);
			SuperSimpleCipher ssc2 = new SuperSimpleCipher(ba, false);
			
			// Encrypt text
			ba = ssc1.encrypt(s.getBytes());
			System.out.println(BotUtil.toHexString(ba));
			System.out.println(ba.length);
			
			// Decrypt text
			s = new String(ssc2.decrypt(ba));
			System.out.println(s);
			System.out.println(s.length());
						
			// PKI
//			KeyPair kp1 = SuperSimpleCipher.generateKeyPair();
//			KeyPair kp2 = SuperSimpleCipher.generateKeyPair();

//			byte[] prk1 = kp1.getPrivate().getEncoded();
//			byte[] prk2 = kp2.getPrivate().getEncoded();

//			byte[] pbk1 = kp1.getPublic().getEncoded();
//			byte[] pbk2 = kp2.getPublic().getEncoded();
			
//			System.out.println(BotUtil.toHexString(prk1));
//			System.out.println(BotUtil.toHexString(prk2));
//			System.out.println(BotUtil.toHexString(pbk1));
//			System.out.println(BotUtil.toHexString(pbk2));
			
			byte[] prk1 = BotUtil.fromHexString("308201670201003082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000443024100b37670abefe1738a1a13a64ebaf241e9c12f1eaf7d93cd68807f2cad5723e7df2558548915c22aef84a90b09532f761ee496dd76ed6accaec2669af60da567c9");
			byte[] prk2 = BotUtil.fromHexString("308201670201003082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a0202020004430241008e53a5cb50b997ac9670795c5b38946921b20a3c15f26cb3a36b8ce077a72b6602da552c78593320c562a826c7d27ca9b895c2e30d2980397274dca44065bcd0");
			byte[] pbk1 = BotUtil.fromHexString("308201a73082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000381850002818100859125964eaceee7e242acf6748b785ead8616fbcf018b7290f0170b66e12ca431787cb79aee6f3dba037fac7ff5c7feef00167d41ee8d63f6d7ded2871f1ac4ed46b46e436889e5802b318d07bbcba8b01102aecce19df4be5d72d16cc7953c15839743c41b214cbd6b55076d9cf9963c66a6b58e71ab9c472a8706ad0cd6c1");
			byte[] pbk2 = BotUtil.fromHexString("308201a73082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000381850002818100bacab201301f1be6ab4f6f1845f4ef9cf8f4dcd9ab82795d457f01986b5347a7d15bc5e247c2e3b5fa9433c8bee362da8bceb773b1c9a318b233c311544cdbbfa53d86ee32e8d0835e510c0d343ab94c3c7653880e0dce946d436dadd04693a498840c8ba30d8c87816e635366a86203eea898097ce5bd929717b9683b3f535b");

			
			SuperSimpleCipher ssc = new SuperSimpleCipher(prk1, pbk2, true);
			ba = ssc.encrypt(s.getBytes());
			System.out.println(BotUtil.toHexString(ba));
			System.out.println(ba.length);
			
			ssc = new SuperSimpleCipher(prk2, pbk1, false);
			ba = ssc.decrypt(ba);
			System.out.println(new String(ba));
		} 
		catch (Exception x) { x.printStackTrace(); }
	}
	
	public byte[] toBytes()
	{
		return secret;
	}

	public static SuperSimpleCipher fromBytes(byte[] ba, boolean write) throws Exception 
	{
		return new SuperSimpleCipher(ba, write);
	}
}
