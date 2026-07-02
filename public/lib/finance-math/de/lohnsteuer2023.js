// GENERATED from scripts/pap/Lohnsteuer2023AbJuli.xml (official BMF Programmablaufplan pseudocode).
// Do not edit — regenerate with: node scripts/gen-de-lohnsteuer.mjs
import { BigDecimal } from "./bigdecimal.js";

// Inputs:  af, AJAHR, ALTER1, ENTSCH, f, JFREIB, JHINZU, JRE4, JVBEZ, KRV, KVZ, LZZ, LZZFREIB, LZZHINZU, MBV, PKPV, PKV, PVS, PVZ, R, RE4, SONSTB, STERBE, STKL, VBEZ, VBEZM, VBEZS, VBS, VJAHR, VKAPA, VMT, ZKF, ZMVB, JRE4ENT, SONSTENT
// Outputs: BK, BKS, BKV, LSTLZZ, SOLZLZZ, SOLZS, SOLZV, STS, STV, VKVLZZ, VKVSONST, VFRB, VFRBS1, VFRBS2, WVFRB, WVFRBO, WVFRBM
export class Lohnsteuer2023 {
  constructor(inputs = {}) {
    this.af = 1;
    this.AJAHR = 0;
    this.ALTER1 = 0;
    this.ENTSCH = new BigDecimal(0);
    this.f = 1.0;
    this.JFREIB = BigDecimal.ZERO;
    this.JHINZU = BigDecimal.ZERO;
    this.JRE4 = BigDecimal.ZERO;
    this.JVBEZ = BigDecimal.ZERO;
    this.KRV = 0;
    this.KVZ = BigDecimal.ZERO;
    this.LZZ = 0;
    this.LZZFREIB = BigDecimal.ZERO;
    this.LZZHINZU = BigDecimal.ZERO;
    this.MBV = BigDecimal.ZERO;
    this.PKPV = new BigDecimal(0);
    this.PKV = 0;
    this.PVS = 0;
    this.PVZ = 0;
    this.R = 0;
    this.RE4 = BigDecimal.ZERO;
    this.SONSTB = BigDecimal.ZERO;
    this.STERBE = BigDecimal.ZERO;
    this.STKL = 0;
    this.VBEZ = BigDecimal.ZERO;
    this.VBEZM = BigDecimal.ZERO;
    this.VBEZS = BigDecimal.ZERO;
    this.VBS = BigDecimal.ZERO;
    this.VJAHR = 0;
    this.VKAPA = BigDecimal.ZERO;
    this.VMT = BigDecimal.ZERO;
    this.ZKF = BigDecimal.ZERO;
    this.ZMVB = 0;
    this.JRE4ENT = BigDecimal.ZERO;
    this.SONSTENT = BigDecimal.ZERO;
    this.BK = new BigDecimal(0);
    this.BKS = new BigDecimal(0);
    this.BKV = new BigDecimal(0);
    this.LSTLZZ = new BigDecimal(0);
    this.SOLZLZZ = new BigDecimal(0);
    this.SOLZS = new BigDecimal(0);
    this.SOLZV = new BigDecimal(0);
    this.STS = new BigDecimal(0);
    this.STV = new BigDecimal(0);
    this.VKVLZZ = new BigDecimal(0);
    this.VKVSONST = new BigDecimal(0);
    this.VFRB = new BigDecimal(0);
    this.VFRBS1 = new BigDecimal(0);
    this.VFRBS2 = new BigDecimal(0);
    this.WVFRB = new BigDecimal(0);
    this.WVFRBO = new BigDecimal(0);
    this.WVFRBM = new BigDecimal(0);
    this.ALTE = new BigDecimal(0);
    this.ANP = new BigDecimal(0);
    this.ANTEIL1 = new BigDecimal(0);
    this.BMG = new BigDecimal(0);
    this.BBGKVPV = new BigDecimal(0);
    this.BBGRV = new BigDecimal(0);
    this.DIFF = new BigDecimal(0);
    this.EFA = new BigDecimal(0);
    this.FVB = new BigDecimal(0);
    this.FVBSO = new BigDecimal(0);
    this.FVBZ = new BigDecimal(0);
    this.FVBZSO = new BigDecimal(0);
    this.GFB = new BigDecimal(0);
    this.HBALTE = new BigDecimal(0);
    this.HFVB = new BigDecimal(0);
    this.HFVBZ = new BigDecimal(0);
    this.HFVBZSO = new BigDecimal(0);
    this.J = 0;
    this.JBMG = new BigDecimal(0);
    this.JLFREIB = new BigDecimal(0);
    this.JLHINZU = new BigDecimal(0);
    this.JW = new BigDecimal(0);
    this.K = 0;
    this.KENNVMT = 0;
    this.KFB = new BigDecimal(0);
    this.KVSATZAG = new BigDecimal(0);
    this.KVSATZAN = new BigDecimal(0);
    this.KZTAB = 0;
    this.LSTJAHR = new BigDecimal(0);
    this.LST1 = new BigDecimal(0);
    this.LST2 = new BigDecimal(0);
    this.LST3 = new BigDecimal(0);
    this.LSTOSO = new BigDecimal(0);
    this.LSTSO = new BigDecimal(0);
    this.MIST = new BigDecimal(0);
    this.PVSATZAG = new BigDecimal(0);
    this.PVSATZAN = new BigDecimal(0);
    this.RVSATZAN = new BigDecimal(0);
    this.RW = new BigDecimal(0);
    this.SAP = new BigDecimal(0);
    this.SOLZFREI = new BigDecimal(0);
    this.SOLZJ = new BigDecimal(0);
    this.SOLZMIN = new BigDecimal(0);
    this.SOLZSBMG = new BigDecimal(0);
    this.SOLZSZVE = new BigDecimal(0);
    this.SOLZVBMG = new BigDecimal(0);
    this.ST = new BigDecimal(0);
    this.ST1 = new BigDecimal(0);
    this.ST2 = new BigDecimal(0);
    this.STOVMT = new BigDecimal(0);
    this.TBSVORV = new BigDecimal(0);
    this.VBEZB = new BigDecimal(0);
    this.VBEZBSO = new BigDecimal(0);
    this.VHB = new BigDecimal(0);
    this.VSP = new BigDecimal(0);
    this.VSPN = new BigDecimal(0);
    this.VSP1 = new BigDecimal(0);
    this.VSP2 = new BigDecimal(0);
    this.VSP3 = new BigDecimal(0);
    this.W1STKL5 = new BigDecimal(0);
    this.W2STKL5 = new BigDecimal(0);
    this.W3STKL5 = new BigDecimal(0);
    this.VSPMAX1 = new BigDecimal(0);
    this.VSPMAX2 = new BigDecimal(0);
    this.VSPO = new BigDecimal(0);
    this.VSPREST = new BigDecimal(0);
    this.VSPVOR = new BigDecimal(0);
    this.X = new BigDecimal(0);
    this.Y = new BigDecimal(0);
    this.ZRE4 = new BigDecimal(0);
    this.ZRE4J = new BigDecimal(0);
    this.ZRE4VP = new BigDecimal(0);
    this.ZTABFB = new BigDecimal(0);
    this.ZVBEZ = new BigDecimal(0);
    this.ZVBEZJ = new BigDecimal(0);
    this.ZVE = new BigDecimal(0);
    this.ZX = new BigDecimal(0);
    this.ZZX = new BigDecimal(0);
    this.HOCH = new BigDecimal(0);
    this.VERGL = new BigDecimal(0);
    this.VKV = new BigDecimal(0);
    this.TAB1 = [BigDecimal.valueOf (0.0), BigDecimal.valueOf (0.4), BigDecimal.valueOf (0.384), BigDecimal.valueOf (0.368), BigDecimal.valueOf (0.352), BigDecimal.valueOf (0.336), BigDecimal.valueOf (0.32), BigDecimal.valueOf (0.304), BigDecimal.valueOf (0.288), BigDecimal.valueOf (0.272), BigDecimal.valueOf (0.256), BigDecimal.valueOf (0.24), BigDecimal.valueOf (0.224), BigDecimal.valueOf (0.208), BigDecimal.valueOf (0.192), BigDecimal.valueOf (0.176), BigDecimal.valueOf (0.16), BigDecimal.valueOf (0.152), BigDecimal.valueOf (0.144), BigDecimal.valueOf (0.136), BigDecimal.valueOf (0.128), BigDecimal.valueOf (0.12), BigDecimal.valueOf (0.112), BigDecimal.valueOf (0.104), BigDecimal.valueOf (0.096), BigDecimal.valueOf (0.088), BigDecimal.valueOf (0.08), BigDecimal.valueOf (0.072), BigDecimal.valueOf (0.064), BigDecimal.valueOf (0.056), BigDecimal.valueOf (0.048), BigDecimal.valueOf (0.04), BigDecimal.valueOf (0.032), BigDecimal.valueOf (0.024), BigDecimal.valueOf (0.016), BigDecimal.valueOf (0.008), BigDecimal.valueOf (0.0)];
    this.TAB2 = [BigDecimal.valueOf (0), BigDecimal.valueOf (3000), BigDecimal.valueOf (2880), BigDecimal.valueOf (2760), BigDecimal.valueOf (2640), BigDecimal.valueOf (2520), BigDecimal.valueOf (2400), BigDecimal.valueOf (2280), BigDecimal.valueOf (2160), BigDecimal.valueOf (2040), BigDecimal.valueOf (1920), BigDecimal.valueOf (1800), BigDecimal.valueOf (1680), BigDecimal.valueOf (1560), BigDecimal.valueOf (1440), BigDecimal.valueOf (1320), BigDecimal.valueOf (1200), BigDecimal.valueOf (1140), BigDecimal.valueOf (1080), BigDecimal.valueOf (1020), BigDecimal.valueOf (960), BigDecimal.valueOf (900), BigDecimal.valueOf (840), BigDecimal.valueOf (780), BigDecimal.valueOf (720), BigDecimal.valueOf (660), BigDecimal.valueOf (600), BigDecimal.valueOf (540), BigDecimal.valueOf (480), BigDecimal.valueOf (420), BigDecimal.valueOf (360), BigDecimal.valueOf (300), BigDecimal.valueOf (240), BigDecimal.valueOf (180), BigDecimal.valueOf (120), BigDecimal.valueOf (60), BigDecimal.valueOf (0)];
    this.TAB3 = [BigDecimal.valueOf (0), BigDecimal.valueOf (900), BigDecimal.valueOf (864), BigDecimal.valueOf (828), BigDecimal.valueOf (792), BigDecimal.valueOf (756), BigDecimal.valueOf (720), BigDecimal.valueOf (684), BigDecimal.valueOf (648), BigDecimal.valueOf (612), BigDecimal.valueOf (576), BigDecimal.valueOf (540), BigDecimal.valueOf (504), BigDecimal.valueOf (468), BigDecimal.valueOf (432), BigDecimal.valueOf (396), BigDecimal.valueOf (360), BigDecimal.valueOf (342), BigDecimal.valueOf (324), BigDecimal.valueOf (306), BigDecimal.valueOf (288), BigDecimal.valueOf (270), BigDecimal.valueOf (252), BigDecimal.valueOf (234), BigDecimal.valueOf (216), BigDecimal.valueOf (198), BigDecimal.valueOf (180), BigDecimal.valueOf (162), BigDecimal.valueOf (144), BigDecimal.valueOf (126), BigDecimal.valueOf (108), BigDecimal.valueOf (90), BigDecimal.valueOf (72), BigDecimal.valueOf (54), BigDecimal.valueOf (36), BigDecimal.valueOf (18), BigDecimal.valueOf (0)];
    this.TAB4 = [BigDecimal.valueOf (0.0), BigDecimal.valueOf (0.4), BigDecimal.valueOf (0.384), BigDecimal.valueOf (0.368), BigDecimal.valueOf (0.352), BigDecimal.valueOf (0.336), BigDecimal.valueOf (0.32), BigDecimal.valueOf (0.304), BigDecimal.valueOf (0.288), BigDecimal.valueOf (0.272), BigDecimal.valueOf (0.256), BigDecimal.valueOf (0.24), BigDecimal.valueOf (0.224), BigDecimal.valueOf (0.208), BigDecimal.valueOf (0.192), BigDecimal.valueOf (0.176), BigDecimal.valueOf (0.16), BigDecimal.valueOf (0.152), BigDecimal.valueOf (0.144), BigDecimal.valueOf (0.136), BigDecimal.valueOf (0.128), BigDecimal.valueOf (0.12), BigDecimal.valueOf (0.112), BigDecimal.valueOf (0.104), BigDecimal.valueOf (0.096), BigDecimal.valueOf (0.088), BigDecimal.valueOf (0.08), BigDecimal.valueOf (0.072), BigDecimal.valueOf (0.064), BigDecimal.valueOf (0.056), BigDecimal.valueOf (0.048), BigDecimal.valueOf (0.04), BigDecimal.valueOf (0.032), BigDecimal.valueOf (0.024), BigDecimal.valueOf (0.016), BigDecimal.valueOf (0.008), BigDecimal.valueOf (0.0)];
    this.TAB5 = [BigDecimal.valueOf (0), BigDecimal.valueOf (1900), BigDecimal.valueOf (1824), BigDecimal.valueOf (1748), BigDecimal.valueOf (1672), BigDecimal.valueOf (1596), BigDecimal.valueOf (1520), BigDecimal.valueOf (1444), BigDecimal.valueOf (1368), BigDecimal.valueOf (1292), BigDecimal.valueOf (1216), BigDecimal.valueOf (1140), BigDecimal.valueOf (1064), BigDecimal.valueOf (988), BigDecimal.valueOf (912), BigDecimal.valueOf (836), BigDecimal.valueOf (760), BigDecimal.valueOf (722), BigDecimal.valueOf (684), BigDecimal.valueOf (646), BigDecimal.valueOf (608), BigDecimal.valueOf (570), BigDecimal.valueOf (532), BigDecimal.valueOf (494), BigDecimal.valueOf (456), BigDecimal.valueOf (418), BigDecimal.valueOf (380), BigDecimal.valueOf (342), BigDecimal.valueOf (304), BigDecimal.valueOf (266), BigDecimal.valueOf (228), BigDecimal.valueOf (190), BigDecimal.valueOf (152), BigDecimal.valueOf (114), BigDecimal.valueOf (76), BigDecimal.valueOf (38), BigDecimal.valueOf (0)];
    this.ZAHL1 = BigDecimal.ONE;
    this.ZAHL2 = new BigDecimal(2);
    this.ZAHL5 = new BigDecimal(5);
    this.ZAHL7 = new BigDecimal(7);
    this.ZAHL12 = new BigDecimal(12);
    this.ZAHL100 = new BigDecimal(100);
    this.ZAHL360 = new BigDecimal(360);
    this.ZAHL500 = new BigDecimal(500);
    this.ZAHL700 = new BigDecimal(700);
    this.ZAHL1000 = new BigDecimal(1000);
    this.ZAHL10000 = new BigDecimal(10000);
    Object.assign(this, inputs);
  }
  calc() { this.MAIN(); return this; }
  MAIN() {
    this.MPARA();
    this.MRE4JL();
    this.VBEZBSO= BigDecimal.ZERO;
    this.KENNVMT= 0;
    this.MRE4();
    this.MRE4ABZ();
    this.MBERECH();
    this.MSONST();
    this.MVMT();
  }
  MPARA() {
    if (this.KRV < 2) {
      if (this.KRV == 0) {
        this.BBGRV = new BigDecimal(87600);
      } else {
        this.BBGRV = new BigDecimal(85200);
      }
      this.RVSATZAN = BigDecimal.valueOf(0.093);
      this.TBSVORV = BigDecimal.valueOf(1.00);
    }
    this.BBGKVPV = new BigDecimal(59850);
    this.KVSATZAN = (this.KVZ.divide(this.ZAHL2).divide(this.ZAHL100)).add(BigDecimal.valueOf(0.07));
    this.KVSATZAG = BigDecimal.valueOf(0.008).add(BigDecimal.valueOf(0.07));
    if (this.LZZ == 1) {
      if (this.PVS == 1) {
        this.PVSATZAN = BigDecimal.valueOf(0.021125);
        this.PVSATZAG = BigDecimal.valueOf(0.011125);
      } else {
        this.PVSATZAN = BigDecimal.valueOf(0.016125);
        this.PVSATZAG = BigDecimal.valueOf(0.016125);
      }
      if (this.PVZ == 1) {
        this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(0.00475));
      }
    } else {
      if (this.PVS == 1) {
        this.PVSATZAN = BigDecimal.valueOf(0.022);
        this.PVSATZAG = BigDecimal.valueOf(0.012);
      } else {
        this.PVSATZAN = BigDecimal.valueOf(0.017);
        this.PVSATZAG = BigDecimal.valueOf(0.017);
      }
      if (this.PVZ == 1) {
        this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(0.006));
      }
    }
    this.W1STKL5 = new BigDecimal(12485);
    this.W2STKL5 = new BigDecimal(31404);
    this.W3STKL5 = new BigDecimal(222260);
    this.GFB = new BigDecimal(10908);
    this.SOLZFREI = new BigDecimal(17543);
  }
  MRE4JL() {
    if (this.LZZ == 1) {
      this.ZRE4J= this.RE4.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
      this.ZVBEZJ= this.VBEZ.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
      this.JLFREIB= this.LZZFREIB.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
      this.JLHINZU= this.LZZHINZU.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
    } else {
      if (this.LZZ == 2) {
        this.ZRE4J= (this.RE4.multiply (this.ZAHL12)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
        this.ZVBEZJ= (this.VBEZ.multiply (this.ZAHL12)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
        this.JLFREIB= (this.LZZFREIB.multiply (this.ZAHL12)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
        this.JLHINZU= (this.LZZHINZU.multiply (this.ZAHL12)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
      } else {
        if (this.LZZ == 3) {
          this.ZRE4J= (this.RE4.multiply (this.ZAHL360)).divide (this.ZAHL700, 2, BigDecimal.ROUND_DOWN);
          this.ZVBEZJ= (this.VBEZ.multiply (this.ZAHL360)).divide (this.ZAHL700, 2, BigDecimal.ROUND_DOWN);
          this.JLFREIB= (this.LZZFREIB.multiply (this.ZAHL360)).divide (this.ZAHL700, 2, BigDecimal.ROUND_DOWN);
          this.JLHINZU= (this.LZZHINZU.multiply (this.ZAHL360)).divide (this.ZAHL700, 2, BigDecimal.ROUND_DOWN);
        } else {
          this.ZRE4J= (this.RE4.multiply (this.ZAHL360)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
          this.ZVBEZJ= (this.VBEZ.multiply (this.ZAHL360)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
          this.JLFREIB= (this.LZZFREIB.multiply (this.ZAHL360)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
          this.JLHINZU= (this.LZZHINZU.multiply (this.ZAHL360)).divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
        }
      }
    }
    if (this.af == 0) {
      this.f= 1;
    }
  }
  MRE4() {
    if (this.ZVBEZJ.compareTo (BigDecimal.ZERO) == 0) {
      this.FVBZ= BigDecimal.ZERO;
      this.FVB= BigDecimal.ZERO;
      this.FVBZSO= BigDecimal.ZERO;
      this.FVBSO= BigDecimal.ZERO;
    } else {
      if (this.VJAHR < 2006) {
        this.J= 1;
      } else {
        if (this.VJAHR < 2040) {
          this.J= this.VJAHR - 2004;
        } else {
          this.J= 36;
        }
      }
      if (this.LZZ == 1) {
        this.VBEZB= (this.VBEZM.multiply (BigDecimal.valueOf (this.ZMVB))).add (this.VBEZS);
        this.HFVB= this.TAB2[this.J].divide (this.ZAHL12).multiply (BigDecimal.valueOf (this.ZMVB));
        this.FVBZ= this.TAB3[this.J].divide (this.ZAHL12).multiply (BigDecimal.valueOf (this.ZMVB)).setScale (0, BigDecimal.ROUND_UP);
      } else {
        this.VBEZB= ((this.VBEZM.multiply (this.ZAHL12)).add (this.VBEZS)).setScale (2, BigDecimal.ROUND_DOWN);
        this.HFVB= this.TAB2[this.J];
        this.FVBZ= this.TAB3[this.J];
      }
      this.FVB= ((this.VBEZB.multiply (this.TAB1[this.J]))).divide (this.ZAHL100).setScale (2, BigDecimal.ROUND_UP);
      if (this.FVB.compareTo (this.HFVB) == 1) {
        this.FVB = this.HFVB;
      }
      if (this.FVB.compareTo (this.ZVBEZJ) == 1) {
        this.FVB = this.ZVBEZJ;
      }
      this.FVBSO= (this.FVB.add((this.VBEZBSO.multiply (this.TAB1[this.J])).divide (this.ZAHL100))).setScale (2, BigDecimal.ROUND_UP);
      if (this.FVBSO.compareTo (this.TAB2[this.J]) == 1) {
        this.FVBSO = this.TAB2[this.J];
      }
      this.HFVBZSO= (((this.VBEZB.add(this.VBEZBSO)).divide (this.ZAHL100)).subtract (this.FVBSO)).setScale (2, BigDecimal.ROUND_DOWN);
      this.FVBZSO= (this.FVBZ.add((this.VBEZBSO).divide (this.ZAHL100))).setScale (0, BigDecimal.ROUND_UP);
      if (this.FVBZSO.compareTo (this.HFVBZSO) == 1) {
        this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
      }
      if (this.FVBZSO.compareTo (this.TAB3[this.J]) == 1) {
        this.FVBZSO = this.TAB3[this.J];
      }
      this.HFVBZ= ((this.VBEZB.divide (this.ZAHL100)).subtract (this.FVB)).setScale (2, BigDecimal.ROUND_DOWN);
      if (this.FVBZ.compareTo (this.HFVBZ) == 1) {
        this.FVBZ = this.HFVBZ.setScale (0, BigDecimal.ROUND_UP);
      }
    }
    this.MRE4ALTE();
  }
  MRE4ALTE() {
    if (this.ALTER1 == 0) {
      this.ALTE= BigDecimal.ZERO;
    } else {
      if (this.AJAHR < 2006) {
        this.K= 1;
      } else {
        if (this.AJAHR < 2040) {
          this.K= this.AJAHR - 2004;
        } else {
          this.K= 36;
        }
      }
      this.BMG= this.ZRE4J.subtract (this.ZVBEZJ);
      this.ALTE = (this.BMG.multiply(this.TAB4[this.K])).setScale(0, BigDecimal.ROUND_UP);
      this.HBALTE= this.TAB5[this.K];
      if (this.ALTE.compareTo (this.HBALTE) == 1) {
        this.ALTE= this.HBALTE;
      }
    }
  }
  MRE4ABZ() {
    this.ZRE4= (this.ZRE4J.subtract (this.FVB).subtract (this.ALTE).subtract (this.JLFREIB).add (this.JLHINZU)).setScale (2, BigDecimal.ROUND_DOWN);
    if (this.ZRE4.compareTo (BigDecimal.ZERO) == -1) {
      this.ZRE4= BigDecimal.ZERO;
    }
    this.ZRE4VP= this.ZRE4J;
    if (this.KENNVMT == 2) {
      this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(this.ZAHL100)).setScale(2,BigDecimal.ROUND_DOWN);
    }
    this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
    if (this.ZVBEZ.compareTo(BigDecimal.ZERO) == -1) {
      this.ZVBEZ = BigDecimal.ZERO;
    }
  }
  MBERECH() {
    this.MZTABFB();
    this.VFRB = ((this.ANP.add(this.FVB.add(this.FVBZ))).multiply(this.ZAHL100)).setScale(0, BigDecimal.ROUND_DOWN);
    this.MLSTJAHR();
    this.WVFRB = ((this.ZVE.subtract(this.GFB)).multiply(this.ZAHL100)).setScale(0, BigDecimal.ROUND_DOWN);
    if (this.WVFRB.compareTo(BigDecimal.ZERO) == -1) {
      this.WVFRB = BigDecimal.valueOf(0);
    }
    this.LSTJAHR = (this.ST.multiply(BigDecimal.valueOf(this.f))).setScale(0,BigDecimal.ROUND_DOWN);
    this.UPLSTLZZ();
    this.UPVKVLZZ();
    if (this.ZKF.compareTo(BigDecimal.ZERO) == 1) {
      this.ZTABFB = this.ZTABFB.add(this.KFB);
      this.MRE4ABZ();
      this.MLSTJAHR();
      this.JBMG = (this.ST.multiply(BigDecimal.valueOf(this.f))).setScale(0,BigDecimal.ROUND_DOWN);
    } else {
      this.JBMG = this.LSTJAHR;
    }
    this.MSOLZ();
  }
  MZTABFB() {
    this.ANP= BigDecimal.ZERO;
    if (this.ZVBEZ.compareTo (BigDecimal.ZERO) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) {
      this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
    }
    if (this.STKL < 6) {
      if (this.ZVBEZ.compareTo (BigDecimal.ZERO) == 1) {
        if ((this.ZVBEZ.subtract (this.FVBZ)).compareTo (BigDecimal.valueOf (102)) == -1) {
          this.ANP= (this.ZVBEZ.subtract (this.FVBZ)).setScale (0, BigDecimal.ROUND_UP);
        } else {
          this.ANP= BigDecimal.valueOf (102);
        }
      }
    } else {
      this.FVBZ= BigDecimal.valueOf (0);
      this.FVBZSO= BigDecimal.valueOf (0);
    }
    if (this.STKL < 6) {
      if (this.ZRE4.compareTo(this.ZVBEZ) == 1) {
        if (this.ZRE4.subtract(this.ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) {
          this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0,BigDecimal.ROUND_UP);
        } else {
          this.ANP = this.ANP.add(BigDecimal.valueOf(1230));
        }
      }
    }
    this.KZTAB= 1;
    if (this.STKL == 1) {
      this.SAP= BigDecimal.valueOf (36);
      this.KFB= (this.ZKF.multiply (BigDecimal.valueOf (8952))).setScale (0, BigDecimal.ROUND_DOWN);
    } else {
      if (this.STKL == 2) {
        this.EFA= BigDecimal.valueOf (4260);
        this.SAP= BigDecimal.valueOf (36);
        this.KFB= (this.ZKF.multiply (BigDecimal.valueOf (8952))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (this.STKL == 3) {
          this.KZTAB= 2;
          this.SAP= BigDecimal.valueOf (36);
          this.KFB= (this.ZKF.multiply (BigDecimal.valueOf (8952))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (this.STKL == 4) {
            this.SAP= BigDecimal.valueOf (36);
            this.KFB= (this.ZKF.multiply (BigDecimal.valueOf (4476))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            if (this.STKL == 5) {
              this.SAP= BigDecimal.valueOf (36);
              this.KFB= BigDecimal.ZERO;
            } else {
              this.KFB= BigDecimal.ZERO;
            }
          }
        }
      }
    }
    this.ZTABFB= (this.EFA.add (this.ANP).add (this.SAP).add (this.FVBZ)).setScale (2, BigDecimal.ROUND_DOWN);
  }
  MLSTJAHR() {
    this.UPEVP();
    if (this.KENNVMT != 1) {
      this.ZVE= (this.ZRE4.subtract (this.ZTABFB).subtract (this.VSP)).setScale (2, BigDecimal.ROUND_DOWN);
      this.UPMLST();
    } else {
      this.ZVE= (this.ZRE4.subtract (this.ZTABFB).subtract (this.VSP).subtract ((this.VMT).divide (this.ZAHL100)).subtract ((this.VKAPA).divide (this.ZAHL100))).setScale (2, BigDecimal.ROUND_DOWN);
      if (this.ZVE.compareTo (BigDecimal.ZERO) == -1) {
        this.ZVE = this.ZVE.add(this.VMT.divide(this.ZAHL100)).add(this.VKAPA.divide(this.ZAHL100)).divide(this.ZAHL5).setScale(2,BigDecimal.ROUND_DOWN);
        this.UPMLST();
        this.ST= (this.ST.multiply (this.ZAHL5)).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        this.UPMLST();
        this.STOVMT= this.ST;
        this.ZVE= (this.ZVE.add(((this.VMT.add (this.VKAPA)).divide (this.ZAHL500)))).setScale (2, BigDecimal.ROUND_DOWN);
        this.UPMLST();
        this.ST= (((this.ST.subtract (this.STOVMT)).multiply (this.ZAHL5)).add (this.STOVMT)).setScale (0, BigDecimal.ROUND_DOWN);
      }
    }
  }
  UPVKVLZZ() {
    this.UPVKV();
    this.JW = this.VKV;
    this.UPANTEIL();
    this.VKVLZZ = this.ANTEIL1;
  }
  UPVKV() {
    if (this.PKV > 0) {
      if (this.VSP2.compareTo(this.VSP3) == 1) {
        this.VKV = this.VSP2.multiply(this.ZAHL100);
      } else {
        this.VKV = this.VSP3.multiply(this.ZAHL100);
      }
    } else {
      this.VKV = BigDecimal.ZERO;
    }
  }
  UPLSTLZZ() {
    this.JW = this.LSTJAHR.multiply(this.ZAHL100);
    this.UPANTEIL();
    this.LSTLZZ = this.ANTEIL1;
  }
  UPMLST() {
    if (this.ZVE.compareTo (this.ZAHL1) == -1) {
      this.ZVE= BigDecimal.ZERO;
      this.X= BigDecimal.ZERO;
    } else {
      this.X= (this.ZVE.divide (BigDecimal.valueOf(this.KZTAB))).setScale (0, BigDecimal.ROUND_DOWN);
    }
    if (this.STKL < 5) {
      this.UPTAB23();
    } else {
      this.MST5_6();
    }
  }
  UPEVP() {
    if (this.KRV > 1) {
      this.VSP1= BigDecimal.ZERO;
    } else {
      if (this.ZRE4VP.compareTo(this.BBGRV) == 1) {
        this.ZRE4VP = this.BBGRV;
      }
      this.VSP1 = (this.TBSVORV.multiply(this.ZRE4VP)).setScale(2,BigDecimal.ROUND_DOWN);
      this.VSP1 = (this.VSP1.multiply(this.RVSATZAN)).setScale(2,BigDecimal.ROUND_DOWN);
    }
    this.VSP2 = (this.ZRE4VP.multiply(BigDecimal.valueOf(0.12))).setScale(2,BigDecimal.ROUND_DOWN);
    if (this.STKL == 3) {
      this.VHB = BigDecimal.valueOf(3000);
    } else {
      this.VHB = BigDecimal.valueOf(1900);
    }
    if (this.VSP2.compareTo (this.VHB) == 1) {
      this.VSP2= this.VHB;
    }
    this.VSPN= (this.VSP1.add (this.VSP2)).setScale (0, BigDecimal.ROUND_UP);
    this.MVSP();
    if (this.VSPN.compareTo (this.VSP) == 1) {
      this.VSP= this.VSPN.setScale (2, BigDecimal.ROUND_DOWN);
    }
  }
  MVSP() {
    if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) {
      this.ZRE4VP = this.BBGKVPV;
    }
    if (this.PKV > 0) {
      if (this.STKL == 6) {
        this.VSP3 = BigDecimal.ZERO;
      } else {
        this.VSP3 = this.PKPV.multiply(this.ZAHL12).divide(this.ZAHL100);
        if (this.PKV == 2) {
          this.VSP3 = this.VSP3.subtract( this.ZRE4VP.multiply( this.KVSATZAG.add(this.PVSATZAG))).setScale(2,BigDecimal.ROUND_DOWN);
        }
      }
    } else {
      this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
    }
    this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
  }
  MST5_6() {
    this.ZZX= this.X;
    if (this.ZZX.compareTo(this.W2STKL5) == 1) {
      this.ZX= this.W2STKL5;
      this.UP5_6();
      if (this.ZZX.compareTo (this.W3STKL5) == 1) {
        this.ST= (this.ST.add ((this.W3STKL5.subtract (this.W2STKL5)).multiply (BigDecimal.valueOf (0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        this.ST= (this.ST.add ((this.ZZX.subtract (this.W3STKL5)).multiply (BigDecimal.valueOf (0.45)))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        this.ST= (this.ST.add ((this.ZZX.subtract (this.W2STKL5)).multiply (BigDecimal.valueOf (0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
      }
    } else {
      this.ZX= this.ZZX;
      this.UP5_6();
      if (this.ZZX.compareTo (this.W1STKL5) == 1) {
        this.VERGL= this.ST;
        this.ZX= this.W1STKL5;
        this.UP5_6();
        this.HOCH= (this.ST.add ((this.ZZX.subtract (this.W1STKL5)).multiply (BigDecimal.valueOf (0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        if (this.HOCH.compareTo (this.VERGL) == -1) {
          this.ST= this.HOCH;
        } else {
          this.ST= this.VERGL;
        }
      }
    }
  }
  UP5_6() {
    this.X= (this.ZX.multiply (BigDecimal.valueOf (1.25))).setScale (2, BigDecimal.ROUND_DOWN);
    this.UPTAB23();
    this.ST1= this.ST;
    this.X= (this.ZX.multiply (BigDecimal.valueOf (0.75))).setScale (2, BigDecimal.ROUND_DOWN);
    this.UPTAB23();
    this.ST2= this.ST;
    this.DIFF= (this.ST1.subtract (this.ST2)).multiply (this.ZAHL2);
    this.MIST= (this.ZX.multiply (BigDecimal.valueOf (0.14))).setScale (0, BigDecimal.ROUND_DOWN);
    if (this.MIST.compareTo (this.DIFF) == 1) {
      this.ST= this.MIST;
    } else {
      this.ST= this.DIFF;
    }
  }
  MSOLZ() {
    this.SOLZFREI = (this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB)));
    if (this.JBMG.compareTo (this.SOLZFREI) == 1) {
      this.SOLZJ= (this.JBMG.multiply (BigDecimal.valueOf (5.5))).divide(this.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
      this.SOLZMIN= (this.JBMG.subtract (this.SOLZFREI)).multiply (BigDecimal.valueOf (11.9)).divide (this.ZAHL100).setScale (2, BigDecimal.ROUND_DOWN);
      if (this.SOLZMIN.compareTo (this.SOLZJ) == -1) {
        this.SOLZJ= this.SOLZMIN;
      }
      this.JW= this.SOLZJ.multiply (this.ZAHL100).setScale (0, BigDecimal.ROUND_DOWN);
      this.UPANTEIL();
      this.SOLZLZZ= this.ANTEIL1;
    } else {
      this.SOLZLZZ= BigDecimal.ZERO;
    }
    if (this.R > 0) {
      this.JW= this.JBMG.multiply (this.ZAHL100);
      this.UPANTEIL();
      this.BK= this.ANTEIL1;
    } else {
      this.BK= BigDecimal.ZERO;
    }
  }
  UPANTEIL() {
    if (this.LZZ == 1) {
      this.ANTEIL1= this.JW;
    } else {
      if (this.LZZ == 2) {
        this.ANTEIL1= this.JW.divide (this.ZAHL12, 0, BigDecimal.ROUND_DOWN);
      } else {
        if (this.LZZ == 3) {
          this.ANTEIL1= (this.JW.multiply (this.ZAHL7)).divide (this.ZAHL360, 0, BigDecimal.ROUND_DOWN);
        } else {
          this.ANTEIL1= this.JW.divide (this.ZAHL360, 0, BigDecimal.ROUND_DOWN);
        }
      }
    }
  }
  MSONST() {
    this.LZZ= 1;
    if (this.ZMVB == 0) {
      this.ZMVB= 12;
    }
    if (this.SONSTB.compareTo (BigDecimal.ZERO) == 0 && this.MBV.compareTo (BigDecimal.ZERO) == 0) {
      this.VKVSONST= BigDecimal.ZERO;
      this.LSTSO= BigDecimal.ZERO;
      this.STS= BigDecimal.ZERO;
      this.SOLZS= BigDecimal.ZERO;
      this.BKS= BigDecimal.ZERO;
    } else {
      this.MOSONST();
      this.UPVKV();
      this.VKVSONST = this.VKV;
      this.ZRE4J= ((this.JRE4.add (this.SONSTB)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.ZVBEZJ= ((this.JVBEZ.add (this.VBS)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.VBEZBSO= this.STERBE;
      this.MRE4SONST();
      this.MLSTJAHR();
      this.WVFRBM = (this.ZVE.subtract(this.GFB)).multiply(this.ZAHL100).setScale(2,BigDecimal.ROUND_DOWN);
      if (this.WVFRBM.compareTo(BigDecimal.ZERO) == -1) {
        this.WVFRBM = BigDecimal.ZERO;
      }
      this.UPVKV();
      this.VKVSONST = this.VKV.subtract(this.VKVSONST);
      this.LSTSO= this.ST.multiply (this.ZAHL100);
      this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(this.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(this.ZAHL100);
      this.STSMIN();
    }
  }
  STSMIN() {
    if (this.STS.compareTo(BigDecimal.ZERO) == -1) {
      if (this.MBV.compareTo(BigDecimal.ZERO) == 0) {
      } else {
        this.LSTLZZ = this.LSTLZZ.add(this.STS);
        if (this.LSTLZZ.compareTo(BigDecimal.ZERO) == -1) {
          this.LSTLZZ = BigDecimal.ZERO;
        }
        this.SOLZLZZ = this.SOLZLZZ.add(this.STS.multiply(BigDecimal.valueOf(5.5).divide(this.ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
        if (this.SOLZLZZ.compareTo(BigDecimal.ZERO) == -1) {
          this.SOLZLZZ = BigDecimal.ZERO;
        }
        this.BK = this.BK.add(this.STS);
        if (this.BK.compareTo(BigDecimal.ZERO) == -1) {
          this.BK = BigDecimal.ZERO;
        }
      }
      this.STS = BigDecimal.ZERO;
      this.SOLZS = BigDecimal.ZERO;
    } else {
      this.MSOLZSTS();
    }
    if (this.R > 0) {
      this.BKS = this.STS;
    } else {
      this.BKS = BigDecimal.ZERO;
    }
  }
  MSOLZSTS() {
    if (this.ZKF.compareTo(BigDecimal.ZERO) == 1) {
      this.SOLZSZVE= this.ZVE.subtract(this.KFB);
    } else {
      this.SOLZSZVE= this.ZVE;
    }
    if (this.SOLZSZVE.compareTo(BigDecimal.ONE) == -1) {
      this.SOLZSZVE= BigDecimal.ZERO;
      this.X= BigDecimal.ZERO;
    } else {
      this.X= this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
    }
    if (this.STKL < 5) {
      this.UPTAB23();
    } else {
      this.MST5_6();
    }
    this.SOLZSBMG= this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0,BigDecimal.ROUND_DOWN);
    if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) {
      this.SOLZS= this.STS.multiply(BigDecimal.valueOf(5.5)).divide(this.ZAHL100, 0, BigDecimal.ROUND_DOWN);
    } else {
      this.SOLZS= BigDecimal.ZERO;
    }
  }
  MVMT() {
    if (this.VKAPA.compareTo (BigDecimal.ZERO) == -1) {
      this.VKAPA= BigDecimal.ZERO;
    }
    if ((this.VMT.add (this.VKAPA)).compareTo (BigDecimal.ZERO) == 1) {
      if (this.LSTSO.compareTo (BigDecimal.ZERO) == 0) {
        this.MOSONST();
        this.LST1= this.LSTOSO;
      } else {
        this.LST1= this.LSTSO;
      }
      this.VBEZBSO= this.STERBE.add (this.VKAPA);
      this.ZRE4J= ((this.JRE4.add (this.SONSTB).add (this.VMT).add (this.VKAPA)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.ZVBEZJ= ((this.JVBEZ.add (this.VBS).add (this.VKAPA)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.KENNVMT = 2;
      this.MRE4SONST();
      this.MLSTJAHR();
      this.LST3= this.ST.multiply (this.ZAHL100);
      this.MRE4ABZ();
      this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(this.ZAHL100)).subtract(this.SONSTENT.divide(this.ZAHL100));
      this.KENNVMT= 1;
      this.MLSTJAHR();
      this.LST2= this.ST.multiply (this.ZAHL100);
      this.STV= this.LST2.subtract (this.LST1);
      this.LST3= this.LST3.subtract (this.LST1);
      if (this.LST3.compareTo (this.STV) == -1) {
        this.STV= this.LST3;
      }
      if (this.STV.compareTo (BigDecimal.ZERO) == -1) {
        this.STV= BigDecimal.ZERO;
      } else {
        this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(this.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(this.ZAHL100);
      }
      this.SOLZVBMG=this.STV.divide(this.ZAHL100, 0, BigDecimal.ROUND_DOWN).add(this.JBMG);
      if (this.SOLZVBMG.compareTo(this.SOLZFREI) == 1) {
        this.SOLZV= this.STV.multiply(BigDecimal.valueOf(5.5)).divide(this.ZAHL100, 0, BigDecimal.ROUND_DOWN);
      } else {
        this.SOLZV= BigDecimal.ZERO;
      }
      if (this.R > 0) {
        this.BKV= this.STV;
      } else {
        this.BKV= BigDecimal.ZERO;
      }
    } else {
      this.STV= BigDecimal.ZERO;
      this.SOLZV= BigDecimal.ZERO;
      this.BKV= BigDecimal.ZERO;
    }
  }
  MOSONST() {
    this.ZRE4J= (this.JRE4.divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
    this.ZVBEZJ= (this.JVBEZ.divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
    this.JLFREIB= this.JFREIB.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
    this.JLHINZU= this.JHINZU.divide (this.ZAHL100, 2, BigDecimal.ROUND_DOWN);
    this.MRE4();
    this.MRE4ABZ();
    this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(this.ZAHL100));
    this.MZTABFB();
    this.VFRBS1 = ((this.ANP.add(this.FVB.add(this.FVBZ))).multiply(this.ZAHL100)).setScale(2,BigDecimal.ROUND_DOWN);
    this.MLSTJAHR();
    this.WVFRBO = ((this.ZVE.subtract(this.GFB)).multiply(this.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
    if (this.WVFRBO.compareTo(BigDecimal.ZERO) == -1) {
      this.WVFRBO = BigDecimal.ZERO;
    }
    this.LSTOSO= this.ST.multiply (this.ZAHL100);
  }
  MRE4SONST() {
    this.MRE4();
    this.FVB= this.FVBSO;
    this.MRE4ABZ();
    this.ZRE4VP = this.ZRE4VP.add(this.MBV.divide(this.ZAHL100)).subtract(this.JRE4ENT.divide(this.ZAHL100)).subtract(this.SONSTENT.divide(this.ZAHL100));
    this.FVBZ= this.FVBZSO;
    this.MZTABFB();
    this.VFRBS2 = ((((this.ANP.add(this.FVB).add(this.FVBZ))).multiply(this.ZAHL100))).subtract(this.VFRBS1);
  }
  UPTAB23() {
    if (this.X.compareTo(this.GFB.add(this.ZAHL1)) == -1) {
      this.ST= BigDecimal.ZERO;
    } else {
      if (this.X.compareTo (BigDecimal.valueOf (16000)) == -1) {
        this.Y = (this.X.subtract(this.GFB)).divide(this.ZAHL10000, 6,BigDecimal.ROUND_DOWN);
        this.RW= this.Y.multiply (BigDecimal.valueOf (979.18));
        this.RW= this.RW.add (BigDecimal.valueOf (1400));
        this.ST= (this.RW.multiply (this.Y)).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (this.X.compareTo (BigDecimal.valueOf (62810)) == -1) {
          this.Y= (this.X.subtract (BigDecimal.valueOf (15999))).divide (this.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
          this.RW= this.Y.multiply (BigDecimal.valueOf (192.59));
          this.RW= this.RW.add (BigDecimal.valueOf (2397));
          this.RW= this.RW.multiply (this.Y);
          this.ST= (this.RW.add (BigDecimal.valueOf (966.53))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (this.X.compareTo (BigDecimal.valueOf (277826)) == -1) {
            this.ST= ((this.X.multiply (BigDecimal.valueOf (0.42))).subtract (BigDecimal.valueOf (9972.98))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            this.ST= ((this.X.multiply (BigDecimal.valueOf (0.45))).subtract (BigDecimal.valueOf (18307.73))).setScale (0, BigDecimal.ROUND_DOWN);
          }
        }
      }
    }
    this.ST= this.ST.multiply (BigDecimal.valueOf (this.KZTAB));
  }
}
Lohnsteuer2023.YEAR = 2023;
