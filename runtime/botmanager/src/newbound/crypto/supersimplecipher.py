import os
import hashlib
from Crypto.Cipher import AES

NEWBOUND_P = 178011905478542266528237562450159990145232156369120674273274450314442865788737020770612695252123463079567156784778466449970650770920727857050009668388144034129745221171818506047231150039301079959358067395348717066319802262019714966524135060945913707594956514672855690606794135837542707371727429551343320695239
NEWBOUND_G = 174068207532402095185811980123523436538604490794561350978495831040599953488455823147851597408940950725307797094915759492368300574252438761037084473467180148876118103083043754985190983472601550494691329488083395492313850000361646482644608492304078721818959999056496097769368017749273708962006689187956744210730
NEWBOUND_L = 512

DH_data = "2a864886f70d010301"

BS = 16
pad = lambda s: s + (BS - len(s) % BS) * bytes([BS - len(s) % BS]) 
unpad = lambda s : s[0:-s[-1]]

class SuperSimpleCipher:
	def __init__(self, key):
		if type(key).__name__ == 'list':
			self.key = self.sharedSecret(key[0], key[1]);
		else:
			self.key = key
		self.cipher = AES.new(self.key, AES.MODE_ECB)
		
	def encrypt( self, raw ):
		raw = pad(raw)
		return self.cipher.encrypt(raw)
		
	def decrypt( self, raw ):
		raw = self.cipher.decrypt(raw)
		return unpad(raw)
	
	@staticmethod
	def sharedSecret(prv, pub):
		prv = PRVKEY(prv)
		pub = PUBKEY(pub)
		pk = KEYPAIR(prv, pub)
		return pk.SECRET
	
	@staticmethod
	def generateKeyPair():
		pMinus2 = NEWBOUND_P - 2
		b = int(NEWBOUND_L / 8)
		x = 0
		while x < 1 or x > pMinus2 or x.bit_length() != NEWBOUND_L:
			x = int_from_bytes(os.urandom(b))
		y = pow(NEWBOUND_G, x, NEWBOUND_P)
		#print(y)
		pub = PUBKEY(int_to_bytes(y), False);
		prv = PRVKEY(int_to_bytes(x), False);
		return [prv.get_encoded(), pub.get_encoded()];
		
	@staticmethod
	def getSeed():
		return os.urandom(BS)

def int_to_bytes(x):
	#numb = x.bit_length() + 7) // 8
	#numb = max(1, (x.bit_length() + 7) // 8)
	#numb = 1 +((x.bit_length() + 7) // 8)
	numb = x.bit_length()//8 + 1
	return x.to_bytes(numb, 'big')

def int_from_bytes(xbytes):
	return int.from_bytes(xbytes, 'big')	

class KEYPAIR:
	def __init__(self, prv, pub):
		self.prv = prv
		self.pub = pub
		
		init_p = prv.P
		init_g = prv.G
		x = prv.KEY
		
		pub_p = pub.P
		pub_g = pub.G
		y = pub.KEY
		
		if not init_p == pub_p or not init_g == pub_g: raise Exception("Incompatible parameters");
		
		expectedLen = (init_p.bit_length() + 7) >> 3
		secret = int_to_bytes(pow(y, x, init_p))
		l = len(secret)
		if l == expectedLen: self.SECRET = secret
		elif l < expectedLen: self.SECRET = (int_to_bytes(0) * (expectedLen-l)) + secret
		elif l == expectedLen + 1: self.SECRET = secret[1:]
		else: raise("Generated secret is out-of-range")
		
		self.SECRET = hashlib.sha256(self.SECRET).digest()[:BS]

class PRVKEY:
	def __init__(self, ba, encoded=True):
		if not encoded:
			self.KEY = int_from_bytes(ba);
			self.P = NEWBOUND_P
			self.G = NEWBOUND_G
			self.L = NEWBOUND_L
		else:
			val = DER(ba)
			if val.tag != 48: raise Exception("Invalid key format")
		
			v = DER(val.data)
			parsedVersion = int_from_bytes(v.data);
			if parsedVersion != 0: raise Exception("version mismatch");
		
			algid = DER(v.rest)
			if (algid.tag != 48): raise Exception ("AlgId is not a SEQUENCE")

			bs = DER(algid.rest)
			if bs.tag != 4: raise Exception("DER input not an octet string")
			k = bs.data;
		
			key = DER(k)
			if key.tag != 2: raise Exception("BIG INT expected as key")
		
			oid = DER(algid.data)
			if oid.tag != 6: raise Exception("Malformed object ID")
			if len(oid.rest) == 0: raise Exception("Parameters missing")
		
			params = DER(oid.rest)
			if params.tag != 48: raise Exception("Parameters not a SEQUENCE")
		
			p = DER(params.data)
			if p.tag != 2: raise Exception("BIG INT expected in params")
		
			g = DER(p.rest)
			if g.tag != 2: raise Exception("BIG INT expected in params")
		
			l = DER(g.rest);
			if l.tag != 2: raise Exception ("Expected integer length")
			if len(l.rest) != 0: raise Exception("Extra parameter data")
		
			self.KEY = int_from_bytes(key.data);
			self.P = int_from_bytes(p.data);
			self.G = int_from_bytes(g.data);
			self.L = int_from_bytes(l.data);
			
	def get_encoded(self):
		p = DER(int_to_bytes(self.P), 2)
		g = DER(int_to_bytes(self.G), 2)
		l = DER(int_to_bytes(self.L), 2)
		g.rest = l.get_encoded()
		p.rest = g.get_encoded()
		paramSequence = DER(p.get_encoded(), 48)
		oid = DER(int_to_bytes(int(DH_data, 16)), 6)
		oid.rest = paramSequence.get_encoded()
		key = DER(DER(int_to_bytes(self.KEY), 2).get_encoded(), 4)
		algid = DER(oid.get_encoded(), 48)
		algid.rest = key.get_encoded()
		zero = int_to_bytes(0)
		tmp = DER(zero, 2)
		tmp.rest = algid.get_encoded()
		derKey = DER(tmp.get_encoded(), 48)
		return derKey.get_encoded()

class PUBKEY:
	def __init__(self, ba, encoded=True):
		if not encoded:
			self.KEY = int_from_bytes(ba);
			self.P = NEWBOUND_P
			self.G = NEWBOUND_G
			self.L = NEWBOUND_L
		else:
			derKeyVal = DER(ba)
			if (derKeyVal.tag != 48): raise Exception ("Invalid key format")
		
			algid = DER(derKeyVal.data)
			if (algid.tag != 48): raise Exception ("AlgId is not a SEQUENCE")
						
			bs = DER(algid.rest)
			numOfPadBits = bs.data[0]
			if numOfPadBits < 0 or numOfPadBits > 7: raise Exception("Invalid number of padding bits")
			k = bs.data[1:]
			if numOfPadBits != 0: k[-1] &= 0xff << numOfPadBits
		
			key = DER(k)
			if key.tag != 2: raise Exception("BIG INT expected as key")
		
			oid = DER(algid.data)
			if oid.tag != 6: raise Exception("Malformed object ID")
			if len(oid.rest) == 0: raise Exception("Parameters missing")
		
			params = DER(oid.rest)
			if params.tag != 48: raise Exception("Parameters not a SEQUENCE")
		
			p = DER(params.data)
			if p.tag != 2: raise Exception("BIG INT expected in params")
		
			g = DER(p.rest)
			if g.tag != 2: raise Exception("BIG INT expected in params")
		
			l = DER(g.rest);
			if l.tag != 2: raise Exception ("Expected integer length")
			if len(l.rest) != 0: raise Exception("Extra parameter data")
		
			self.KEY = int_from_bytes(key.data);
			self.P = int_from_bytes(p.data);
			self.G = int_from_bytes(g.data);
			self.L = int_from_bytes(l.data);
			
	def get_encoded(self):
		p = DER(int_to_bytes(self.P), 2)
		g = DER(int_to_bytes(self.G), 2)
		l = DER(int_to_bytes(self.L), 2)
		g.rest = l.get_encoded()
		p.rest = g.get_encoded()
		paramSequence = DER(p.get_encoded(), 48)
		oid = DER(int_to_bytes(int(DH_data, 16)), 6)
		oid.rest = paramSequence.get_encoded()
		key = int_to_bytes(0)+DER(int_to_bytes(self.KEY), 2).get_encoded()
		bitstringbytes = DER(key, 3)
		algid = DER(oid.get_encoded(), 48)
		algid.rest = bitstringbytes.get_encoded()
		derKey = DER(algid.get_encoded(), 48)
		return derKey.get_encoded()

class DER:
	def __init__(self, ba, tag=-1):
		if tag != -1:
			self.tag = tag
			self.data = ba
			self.rest = b''
		else:
			self.tag = 0xFF & ba[0]
			tmp = 0xff & ba[1]
			off = 2
			ll = 0
			if (tmp & 0x080) == 0x00: ll = tmp
			else:
				tmp &= 0x07f
				if tmp == 0: ll = -1
				elif tmp < 0 or tmp > 4: raise Exception("BAD DER")
				else:
					ll = 0
					while tmp>0:
						ll <<= 8
						ll += 0x0ff & ba[off]
						off += 1
						tmp -= 1
			if ll < 0: raise Exception("BAD DER LENGTH")
			self.data = ba[off:off+ll]
			self.rest = ba[off+ll:]
	
	def get_encoded(self):
		#if self.tag == 2: self.data = b'1' * len(self.data)
		lba = self.length_bytes(len(self.data))
		ba = int_to_bytes(self.tag) + lba + self.data + self.rest
		return ba
		
	def length_bytes(self, l):
		la = int_to_bytes(l)
		if l < 128: return la[-1:]
		elif l < (1 << 8): return int_to_bytes(0x81)[-1:] + la[-1:]
		elif l < (1 << 16): return int_to_bytes(0x82)[-1:] + la[-2:]
		elif l < (1 << 24): return int_to_bytes(0x83)[-1:] + la[-3:]
		else: return int_to_bytes(0x084)[-1:] + la[-4:]
		
if __name__ == '__main__':
	kp1 = SuperSimpleCipher.generateKeyPair()
	print(kp1[0].hex())
	print(kp1[1].hex())
	#y = 86872786635225049541656766353556405442581762930564240941848647663092842803276913221836439628253413964395958166748813561022663616465845417488067902103527661283700325121729402806878509356237547842108798309815334023998552254014771328929609098396120781333975239135772008992804207505478231435933526695690124391556
	#y = 103398374052213756565263754204354716431191314403528086247603867067738774202638356074531883278879540695896049222435258759032771530595199608871866317469787043037927530610123002280976479373011034299166157919436238417408697261425532276090134959332634111099114447019081735164080945274198821546645210407548566404413
	#p = 178011905478542266528237562450159990145232156369120674273274450314442865788737020770612695252123463079567156784778466449970650770920727857050009668388144034129745221171818506047231150039301079959358067395348717066319802262019714966524135060945913707594956514672855690606794135837542707371727429551343320695239
	#g = 174068207532402095185811980123523436538604490794561350978495831040599953488455823147851597408940950725307797094915759492368300574252438761037084473467180148876118103083043754985190983472601550494691329488083395492313850000361646482644608492304078721818959999056496097769368017749273708962006689187956744210730
	#pub = PUBKEY(int_to_bytes(y), False)
	#print(pub.get_encoded().hex())
	#print(int_to_bytes(y).hex())
	#ba = bytes.fromhex("308201a73082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000381850002818100811b43d8d54a685a73be6e5141b0e3cfe3c6849507afc4d2391ddb277eab6b74e2782a488a0e04b1967e64b357f84145bca63e7d73589189113dcdeb449d0232a5d8e66f02d40a7f3ffc6f2176e81fd3bad8197a70c8e2c5f9043ef2ce75bce5cdc0e38c6d93ef7855978f2e2863ff5de685b85037ebe64300b487af67e41b57")
	#pub = PUBKEY(ba, True)
	#print(pub.get_encoded().hex())
	
if False: #__name__ == '__main__':
	# AES Example
	key = bytes.fromhex("b56fc308b12c3c27602a3c40f35b0e51")
	plaintext = "I am the very model of a modern major general".encode()
	print('KEY = ' + key.hex())
	print('PLAINTEXT = ' + plaintext.decode())

	encryptor = SuperSimpleCipher(key)
	ciphertext = encryptor.encrypt(plaintext)
	print('CIPHER = ' + ciphertext.hex())				

	res = encryptor.decrypt(ciphertext)
	print('RESULT = ' + res.decode())				

	# PKI Example 1
	sprk1 = "308201670201003082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000443024100b37670abefe1738a1a13a64ebaf241e9c12f1eaf7d93cd68807f2cad5723e7df2558548915c22aef84a90b09532f761ee496dd76ed6accaec2669af60da567c9"
	sprk2 = "308201670201003082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a0202020004430241008e53a5cb50b997ac9670795c5b38946921b20a3c15f26cb3a36b8ce077a72b6602da552c78593320c562a826c7d27ca9b895c2e30d2980397274dca44065bcd0"
	spbk1 = "308201a73082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000381850002818100859125964eaceee7e242acf6748b785ead8616fbcf018b7290f0170b66e12ca431787cb79aee6f3dba037fac7ff5c7feef00167d41ee8d63f6d7ded2871f1ac4ed46b46e436889e5802b318d07bbcba8b01102aecce19df4be5d72d16cc7953c15839743c41b214cbd6b55076d9cf9963c66a6b58e71ab9c472a8706ad0cd6c1"
	spbk2 = "308201a73082011b06092a864886f70d0103013082010c02818100fd7f53811d75122952df4a9c2eece4e7f611b7523cef4400c31e3f80b6512669455d402251fb593d8d58fabfc5f5ba30f6cb9b556cd7813b801d346ff26660b76b9950a5a49f9fe8047b1022c24fbba9d7feb7c61bf83b57e7c6a8a6150f04fb83f6d3c51ec3023554135a169132f675f3ae2b61d72aeff22203199dd14801c702818100f7e1a085d69b3ddecbbcab5c36b857b97994afbbfa3aea82f9574c0b3d0782675159578ebad4594fe67107108180b449167123e84c281613b7cf09328cc8a6e13c167a8b547c8d28e0a3ae1e2bb3a675916ea37f0bfa213562f1fb627a01243bcca4f1bea8519089a883dfe15ae59f06928b665e807b552564014c3bfecf492a020202000381850002818100bacab201301f1be6ab4f6f1845f4ef9cf8f4dcd9ab82795d457f01986b5347a7d15bc5e247c2e3b5fa9433c8bee362da8bceb773b1c9a318b233c311544cdbbfa53d86ee32e8d0835e510c0d343ab94c3c7653880e0dce946d436dadd04693a498840c8ba30d8c87816e635366a86203eea898097ce5bd929717b9683b3f535b"

	ssc1 = SuperSimpleCipher([bytes.fromhex(sprk1), bytes.fromhex(spbk2)])
	ciphertext = ssc1.encrypt(plaintext)
	print('CIPHER = ' + ciphertext.hex())				
	
	ssc2 = SuperSimpleCipher([bytes.fromhex(sprk2), bytes.fromhex(spbk1)])
	res = ssc2.decrypt(ciphertext)
	print('RESULT = ' + res.decode())		

	print(spbk1 == PUBKEY(bytes.fromhex(spbk1)).get_encoded().hex())	
	print(sprk1 == PRVKEY(bytes.fromhex(sprk1)).get_encoded().hex())	
	print(spbk2 == PUBKEY(bytes.fromhex(spbk2)).get_encoded().hex())	
	print(sprk2 == PRVKEY(bytes.fromhex(sprk2)).get_encoded().hex())
	
	# PKI Example 2
	kp1 = SuperSimpleCipher.generateKeyPair()
	kp2 = SuperSimpleCipher.generateKeyPair()
	
	ssc1 = SuperSimpleCipher([kp1[0], kp2[1]])
	ssc2 = SuperSimpleCipher([kp2[0], kp1[1]])
	
	ba = ssc1.encrypt(plaintext)
	print(ba.hex())
	
	ba = ssc2.decrypt(ba)
	print(ba.decode())




	
	