// GENERATED from scripts/pap/Lohnsteuer2026.xml (official BMF Programmablaufplan pseudocode).
// Do not edit — regenerate with: node scripts/gen-de-lohnsteuer.mjs
import { BigDecimal } from "./bigdecimal.js";

// Inputs:  af, AJAHR, ALTER1, ALV, f, JFREIB, JHINZU, JRE4, JRE4ENT, JVBEZ, KRV, KVZ, LZZ, LZZFREIB, LZZHINZU, MBV, PKPV, PKPVAGZ, PKV, PVA, PVS, PVZ, R, RE4, SONSTB, SONSTENT, STERBE, STKL, VBEZ, VBEZM, VBEZS, VBS, VJAHR, ZKF, ZMVB
// Outputs: BK, BKS, LSTLZZ, SOLZLZZ, SOLZS, STS, VFRB, VFRBS1, VFRBS2, WVFRB, WVFRBO, WVFRBM
export class Lohnsteuer2026 {
  constructor(inputs = {}) {
    this.af = 1;
    this.AJAHR = 0;
    this.ALTER1 = 0;
    this.ALV = 0;
    this.f = 1.0;
    this.JFREIB = BigDecimal.ZERO;
    this.JHINZU = BigDecimal.ZERO;
    this.JRE4 = BigDecimal.ZERO;
    this.JRE4ENT = BigDecimal.ZERO;
    this.JVBEZ = BigDecimal.ZERO;
    this.KRV = 0;
    this.KVZ = BigDecimal.ZERO;
    this.LZZ = 1;
    this.LZZFREIB = BigDecimal.ZERO;
    this.LZZHINZU = BigDecimal.ZERO;
    this.MBV = BigDecimal.ZERO;
    this.PKPV = BigDecimal.ZERO;
    this.PKPVAGZ = BigDecimal.ZERO;
    this.PKV = 0;
    this.PVA = BigDecimal.ZERO;
    this.PVS = 0;
    this.PVZ = 0;
    this.R = 0;
    this.RE4 = BigDecimal.ZERO;
    this.SONSTB = BigDecimal.ZERO;
    this.SONSTENT = BigDecimal.ZERO;
    this.STERBE = BigDecimal.ZERO;
    this.STKL = 1;
    this.VBEZ = BigDecimal.ZERO;
    this.VBEZM = BigDecimal.ZERO;
    this.VBEZS = BigDecimal.ZERO;
    this.VBS = BigDecimal.ZERO;
    this.VJAHR = 0;
    this.ZKF = BigDecimal.ZERO;
    this.ZMVB = 0;
    this.BK = BigDecimal.ZERO;
    this.BKS = BigDecimal.ZERO;
    this.LSTLZZ = BigDecimal.ZERO;
    this.SOLZLZZ = BigDecimal.ZERO;
    this.SOLZS = BigDecimal.ZERO;
    this.STS = BigDecimal.ZERO;
    this.VFRB = BigDecimal.ZERO;
    this.VFRBS1 = BigDecimal.ZERO;
    this.VFRBS2 = BigDecimal.ZERO;
    this.WVFRB = BigDecimal.ZERO;
    this.WVFRBO = BigDecimal.ZERO;
    this.WVFRBM = BigDecimal.ZERO;
    this.ALTE = BigDecimal.ZERO;
    this.ANP = BigDecimal.ZERO;
    this.ANTEIL1 = BigDecimal.ZERO;
    this.AVSATZAN = BigDecimal.ZERO;
    this.BBGKVPV = BigDecimal.ZERO;
    this.BBGRVALV = BigDecimal.ZERO;
    this.BMG = BigDecimal.ZERO;
    this.DIFF = BigDecimal.ZERO;
    this.EFA = BigDecimal.ZERO;
    this.FVB = BigDecimal.ZERO;
    this.FVBSO = BigDecimal.ZERO;
    this.FVBZ = BigDecimal.ZERO;
    this.FVBZSO = BigDecimal.ZERO;
    this.GFB = BigDecimal.ZERO;
    this.HBALTE = BigDecimal.ZERO;
    this.HFVB = BigDecimal.ZERO;
    this.HFVBZ = BigDecimal.ZERO;
    this.HFVBZSO = BigDecimal.ZERO;
    this.HOCH = BigDecimal.ZERO;
    this.J = 0;
    this.JBMG = BigDecimal.ZERO;
    this.JLFREIB = BigDecimal.ZERO;
    this.JLHINZU = BigDecimal.ZERO;
    this.JW = BigDecimal.ZERO;
    this.K = 0;
    this.KFB = BigDecimal.ZERO;
    this.KVSATZAN = BigDecimal.ZERO;
    this.KZTAB = 0;
    this.LSTJAHR = BigDecimal.ZERO;
    this.LSTOSO = BigDecimal.ZERO;
    this.LSTSO = BigDecimal.ZERO;
    this.MIST = BigDecimal.ZERO;
    this.PKPVAGZJ = BigDecimal.ZERO;
    this.PVSATZAN = BigDecimal.ZERO;
    this.RVSATZAN = BigDecimal.ZERO;
    this.RW = BigDecimal.ZERO;
    this.SAP = BigDecimal.ZERO;
    this.SOLZFREI = BigDecimal.ZERO;
    this.SOLZJ = BigDecimal.ZERO;
    this.SOLZMIN = BigDecimal.ZERO;
    this.SOLZSBMG = BigDecimal.ZERO;
    this.SOLZSZVE = BigDecimal.ZERO;
    this.ST = BigDecimal.ZERO;
    this.ST1 = BigDecimal.ZERO;
    this.ST2 = BigDecimal.ZERO;
    this.VBEZB = BigDecimal.ZERO;
    this.VBEZBSO = BigDecimal.ZERO;
    this.VERGL = BigDecimal.ZERO;
    this.VSPHB = BigDecimal.ZERO;
    this.VSP = BigDecimal.ZERO;
    this.VSPN = BigDecimal.ZERO;
    this.VSPALV = BigDecimal.ZERO;
    this.VSPKVPV = BigDecimal.ZERO;
    this.VSPR = BigDecimal.ZERO;
    this.W1STKL5 = BigDecimal.ZERO;
    this.W2STKL5 = BigDecimal.ZERO;
    this.W3STKL5 = BigDecimal.ZERO;
    this.X = BigDecimal.ZERO;
    this.Y = BigDecimal.ZERO;
    this.ZRE4 = BigDecimal.ZERO;
    this.ZRE4J = BigDecimal.ZERO;
    this.ZRE4VP = BigDecimal.ZERO;
    this.ZRE4VPR = BigDecimal.ZERO;
    this.ZTABFB = BigDecimal.ZERO;
    this.ZVBEZ = BigDecimal.ZERO;
    this.ZVBEZJ = BigDecimal.ZERO;
    this.ZVE = BigDecimal.ZERO;
    this.ZX = BigDecimal.ZERO;
    this.ZZX = BigDecimal.ZERO;
    this.TAB1 = [BigDecimal.ZERO, BigDecimal.valueOf( 0.4), BigDecimal.valueOf( 0.384), BigDecimal.valueOf( 0.368), BigDecimal.valueOf( 0.352), BigDecimal.valueOf( 0.336), BigDecimal.valueOf( 0.32), BigDecimal.valueOf( 0.304), BigDecimal.valueOf( 0.288), BigDecimal.valueOf( 0.272), BigDecimal.valueOf( 0.256), BigDecimal.valueOf( 0.24), BigDecimal.valueOf( 0.224), BigDecimal.valueOf( 0.208), BigDecimal.valueOf( 0.192), BigDecimal.valueOf( 0.176), BigDecimal.valueOf( 0.16), BigDecimal.valueOf( 0.152), BigDecimal.valueOf( 0.144), BigDecimal.valueOf( 0.14), BigDecimal.valueOf( 0.136), BigDecimal.valueOf( 0.132), BigDecimal.valueOf( 0.128), BigDecimal.valueOf( 0.124), BigDecimal.valueOf( 0.12), BigDecimal.valueOf( 0.116), BigDecimal.valueOf( 0.112), BigDecimal.valueOf( 0.108), BigDecimal.valueOf( 0.104), BigDecimal.valueOf( 0.1), BigDecimal.valueOf( 0.096), BigDecimal.valueOf( 0.092), BigDecimal.valueOf( 0.088), BigDecimal.valueOf( 0.084), BigDecimal.valueOf( 0.08), BigDecimal.valueOf( 0.076), BigDecimal.valueOf( 0.072), BigDecimal.valueOf( 0.068), BigDecimal.valueOf( 0.064), BigDecimal.valueOf( 0.06), BigDecimal.valueOf( 0.056), BigDecimal.valueOf( 0.052), BigDecimal.valueOf( 0.048), BigDecimal.valueOf( 0.044), BigDecimal.valueOf( 0.04), BigDecimal.valueOf( 0.036), BigDecimal.valueOf( 0.032), BigDecimal.valueOf( 0.028), BigDecimal.valueOf( 0.024), BigDecimal.valueOf( 0.02), BigDecimal.valueOf( 0.016), BigDecimal.valueOf( 0.012), BigDecimal.valueOf( 0.008), BigDecimal.valueOf( 0.004), BigDecimal.valueOf( 0)];
    this.TAB2 = [BigDecimal.ZERO, BigDecimal.valueOf( 3000), BigDecimal.valueOf( 2880), BigDecimal.valueOf( 2760), BigDecimal.valueOf( 2640), BigDecimal.valueOf( 2520), BigDecimal.valueOf( 2400), BigDecimal.valueOf( 2280), BigDecimal.valueOf( 2160), BigDecimal.valueOf( 2040), BigDecimal.valueOf( 1920), BigDecimal.valueOf( 1800), BigDecimal.valueOf( 1680), BigDecimal.valueOf( 1560), BigDecimal.valueOf( 1440), BigDecimal.valueOf( 1320), BigDecimal.valueOf( 1200), BigDecimal.valueOf( 1140), BigDecimal.valueOf( 1080), BigDecimal.valueOf( 1050), BigDecimal.valueOf( 1020), BigDecimal.valueOf( 990), BigDecimal.valueOf( 960), BigDecimal.valueOf( 930), BigDecimal.valueOf( 900), BigDecimal.valueOf( 870), BigDecimal.valueOf( 840), BigDecimal.valueOf( 810), BigDecimal.valueOf( 780), BigDecimal.valueOf( 750), BigDecimal.valueOf( 720), BigDecimal.valueOf( 690), BigDecimal.valueOf( 660), BigDecimal.valueOf( 630), BigDecimal.valueOf( 600), BigDecimal.valueOf( 570), BigDecimal.valueOf( 540), BigDecimal.valueOf( 510), BigDecimal.valueOf( 480), BigDecimal.valueOf( 450), BigDecimal.valueOf( 420), BigDecimal.valueOf( 390), BigDecimal.valueOf( 360), BigDecimal.valueOf( 330), BigDecimal.valueOf( 300), BigDecimal.valueOf( 270), BigDecimal.valueOf( 240), BigDecimal.valueOf( 210), BigDecimal.valueOf( 180), BigDecimal.valueOf( 150), BigDecimal.valueOf( 120), BigDecimal.valueOf( 90), BigDecimal.valueOf( 60), BigDecimal.valueOf( 30), BigDecimal.valueOf( 0) ];
    this.TAB3 = [BigDecimal.ZERO, BigDecimal.valueOf( 900), BigDecimal.valueOf( 864), BigDecimal.valueOf( 828), BigDecimal.valueOf( 792), BigDecimal.valueOf( 756), BigDecimal.valueOf( 720), BigDecimal.valueOf( 684), BigDecimal.valueOf( 648), BigDecimal.valueOf( 612), BigDecimal.valueOf( 576), BigDecimal.valueOf( 540), BigDecimal.valueOf( 504), BigDecimal.valueOf( 468), BigDecimal.valueOf( 432), BigDecimal.valueOf( 396), BigDecimal.valueOf( 360), BigDecimal.valueOf( 342), BigDecimal.valueOf( 324), BigDecimal.valueOf( 315), BigDecimal.valueOf( 306), BigDecimal.valueOf( 297), BigDecimal.valueOf( 288), BigDecimal.valueOf( 279), BigDecimal.valueOf( 270), BigDecimal.valueOf( 261), BigDecimal.valueOf( 252), BigDecimal.valueOf( 243), BigDecimal.valueOf( 234), BigDecimal.valueOf( 225), BigDecimal.valueOf( 216), BigDecimal.valueOf( 207), BigDecimal.valueOf( 198), BigDecimal.valueOf( 189), BigDecimal.valueOf( 180), BigDecimal.valueOf( 171), BigDecimal.valueOf( 162), BigDecimal.valueOf( 153), BigDecimal.valueOf( 144), BigDecimal.valueOf( 135), BigDecimal.valueOf( 126), BigDecimal.valueOf( 117), BigDecimal.valueOf( 108), BigDecimal.valueOf( 99), BigDecimal.valueOf( 90), BigDecimal.valueOf( 81), BigDecimal.valueOf( 72), BigDecimal.valueOf( 63), BigDecimal.valueOf( 54), BigDecimal.valueOf( 45), BigDecimal.valueOf( 36), BigDecimal.valueOf( 27), BigDecimal.valueOf( 18), BigDecimal.valueOf( 9), BigDecimal.valueOf( 0)];
    this.TAB4 = [BigDecimal.ZERO, BigDecimal.valueOf( 0.4), BigDecimal.valueOf( 0.384), BigDecimal.valueOf( 0.368), BigDecimal.valueOf( 0.352), BigDecimal.valueOf( 0.336), BigDecimal.valueOf( 0.32), BigDecimal.valueOf( 0.304), BigDecimal.valueOf( 0.288), BigDecimal.valueOf( 0.272), BigDecimal.valueOf( 0.256), BigDecimal.valueOf( 0.24), BigDecimal.valueOf( 0.224), BigDecimal.valueOf( 0.208), BigDecimal.valueOf( 0.192), BigDecimal.valueOf( 0.176), BigDecimal.valueOf( 0.16), BigDecimal.valueOf( 0.152), BigDecimal.valueOf( 0.144), BigDecimal.valueOf( 0.14), BigDecimal.valueOf( 0.136), BigDecimal.valueOf( 0.132), BigDecimal.valueOf( 0.128), BigDecimal.valueOf( 0.124), BigDecimal.valueOf( 0.12), BigDecimal.valueOf( 0.116), BigDecimal.valueOf( 0.112), BigDecimal.valueOf( 0.108), BigDecimal.valueOf( 0.104), BigDecimal.valueOf( 0.1), BigDecimal.valueOf( 0.096), BigDecimal.valueOf( 0.092), BigDecimal.valueOf( 0.088), BigDecimal.valueOf( 0.084), BigDecimal.valueOf( 0.08), BigDecimal.valueOf( 0.076), BigDecimal.valueOf( 0.072), BigDecimal.valueOf( 0.068), BigDecimal.valueOf( 0.064), BigDecimal.valueOf( 0.06), BigDecimal.valueOf( 0.056), BigDecimal.valueOf( 0.052), BigDecimal.valueOf( 0.048), BigDecimal.valueOf( 0.044), BigDecimal.valueOf( 0.04), BigDecimal.valueOf( 0.036), BigDecimal.valueOf( 0.032), BigDecimal.valueOf( 0.028), BigDecimal.valueOf( 0.024), BigDecimal.valueOf( 0.02), BigDecimal.valueOf( 0.016), BigDecimal.valueOf( 0.012), BigDecimal.valueOf( 0.008), BigDecimal.valueOf( 0.004), BigDecimal.valueOf( 0)];
    this.TAB5 = [BigDecimal.ZERO, BigDecimal.valueOf( 1900), BigDecimal.valueOf( 1824), BigDecimal.valueOf( 1748), BigDecimal.valueOf( 1672), BigDecimal.valueOf( 1596), BigDecimal.valueOf( 1520), BigDecimal.valueOf( 1444), BigDecimal.valueOf( 1368), BigDecimal.valueOf( 1292), BigDecimal.valueOf( 1216), BigDecimal.valueOf( 1140), BigDecimal.valueOf( 1064), BigDecimal.valueOf( 988), BigDecimal.valueOf( 912), BigDecimal.valueOf( 836), BigDecimal.valueOf( 760), BigDecimal.valueOf( 722), BigDecimal.valueOf( 684), BigDecimal.valueOf( 665), BigDecimal.valueOf( 646), BigDecimal.valueOf( 627), BigDecimal.valueOf( 608), BigDecimal.valueOf( 589), BigDecimal.valueOf( 570), BigDecimal.valueOf( 551), BigDecimal.valueOf( 532), BigDecimal.valueOf( 513), BigDecimal.valueOf( 494), BigDecimal.valueOf( 475), BigDecimal.valueOf( 456), BigDecimal.valueOf( 437), BigDecimal.valueOf( 418), BigDecimal.valueOf( 399), BigDecimal.valueOf( 380), BigDecimal.valueOf( 361), BigDecimal.valueOf( 342), BigDecimal.valueOf( 323), BigDecimal.valueOf( 304), BigDecimal.valueOf( 285), BigDecimal.valueOf( 266), BigDecimal.valueOf( 247), BigDecimal.valueOf( 228), BigDecimal.valueOf( 209), BigDecimal.valueOf( 190), BigDecimal.valueOf( 171), BigDecimal.valueOf( 152), BigDecimal.valueOf( 133), BigDecimal.valueOf( 114), BigDecimal.valueOf( 95), BigDecimal.valueOf( 76), BigDecimal.valueOf( 57), BigDecimal.valueOf( 38), BigDecimal.valueOf( 19), BigDecimal.valueOf( 0)];
    this.ZAHL1 = BigDecimal.ONE;
    this.ZAHL2 = BigDecimal.valueOf(2);
    this.ZAHL5 = BigDecimal.valueOf(5);
    this.ZAHL7 = BigDecimal.valueOf(7);
    this.ZAHL12 = BigDecimal.valueOf(12);
    this.ZAHL100 = BigDecimal.valueOf(100);
    this.ZAHL360 = BigDecimal.valueOf(360);
    this.ZAHL500 = BigDecimal.valueOf(500);
    this.ZAHL700 = BigDecimal.valueOf(700);
    this.ZAHL1000 = BigDecimal.valueOf(1000);
    this.ZAHL10000 = BigDecimal.valueOf(10000);
    Object.assign(this, inputs);
  }
  calc() { this.MAIN(); return this; }
  MAIN() {
    this.MPARA();
    this.MRE4JL();
    this.VBEZBSO= BigDecimal.ZERO;
    this.MRE4();
    this.MRE4ABZ();
    this.MBERECH();
    this.MSONST();
  }
  MPARA() {
    this.BBGRVALV = BigDecimal.valueOf(101400);
    this.AVSATZAN = BigDecimal.valueOf(0.013);
    this.RVSATZAN = BigDecimal.valueOf(0.093);
    this.BBGKVPV = BigDecimal.valueOf(69750);
    this.KVSATZAN = (this.KVZ.divide(this.ZAHL2).divide(this.ZAHL100)).add(BigDecimal.valueOf(0.07));
    if (this.PVS == 1) {
      this.PVSATZAN = BigDecimal.valueOf(0.023);
    } else {
      this.PVSATZAN = BigDecimal.valueOf(0.018);
    }
    if (this.PVZ == 1) {
      this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(0.006));
    } else {
      this.PVSATZAN = this.PVSATZAN.subtract(this.PVA.multiply(BigDecimal.valueOf(0.0025)));
    }
    this.W1STKL5 = BigDecimal.valueOf(14071);
    this.W2STKL5 = BigDecimal.valueOf(34939);
    this.W3STKL5 = BigDecimal.valueOf(222260);
    this.GFB = BigDecimal.valueOf(12348);
    this.SOLZFREI = BigDecimal.valueOf(20350);
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
        if (this.VJAHR < 2058) {
          this.J= this.VJAHR - 2004;
        } else {
          this.J= 54;
        }
      }
      if (this.LZZ == 1) {
        this.VBEZB= (this.VBEZM.multiply (BigDecimal.valueOf(this.ZMVB))).add (this.VBEZS);
        this.HFVB= this.TAB2[this.J].divide (this.ZAHL12).multiply (BigDecimal.valueOf(this.ZMVB)).setScale (0, BigDecimal.ROUND_UP);
        this.FVBZ= this.TAB3[this.J].divide (this.ZAHL12).multiply (BigDecimal.valueOf(this.ZMVB)).setScale (0, BigDecimal.ROUND_UP);
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
        if (this.AJAHR < 2058) {
          this.K= this.AJAHR - 2004;
        } else {
          this.K= 54;
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
      this.WVFRB = BigDecimal.ZERO;
    }
    this.LSTJAHR = (this.ST.multiply(BigDecimal.valueOf(this.f))).setScale(0,BigDecimal.ROUND_DOWN);
    this.UPLSTLZZ();
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
        if ((this.ZVBEZ.subtract (this.FVBZ)).compareTo (BigDecimal.valueOf(102)) == -1) {
          this.ANP= (this.ZVBEZ.subtract (this.FVBZ)).setScale (0, BigDecimal.ROUND_UP);
        } else {
          this.ANP= BigDecimal.valueOf(102);
        }
      }
    } else {
      this.FVBZ= BigDecimal.ZERO;
      this.FVBZSO= BigDecimal.ZERO;
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
      this.SAP= BigDecimal.valueOf(36);
      this.KFB= (this.ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
    } else {
      if (this.STKL == 2) {
        this.EFA= BigDecimal.valueOf(4260);
        this.SAP= BigDecimal.valueOf(36);
        this.KFB= (this.ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (this.STKL == 3) {
          this.KZTAB= 2;
          this.SAP= BigDecimal.valueOf(36);
          this.KFB= (this.ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (this.STKL == 4) {
            this.SAP= BigDecimal.valueOf(36);
            this.KFB= (this.ZKF.multiply (BigDecimal.valueOf(4878))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            if (this.STKL == 5) {
              this.SAP= BigDecimal.valueOf(36);
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
    this.ZVE= this.ZRE4.subtract (this.ZTABFB).subtract(this.VSP);
    this.UPMLST();
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
      this.UPTAB26();
    } else {
      this.MST5_6();
    }
  }
  UPEVP() {
    if (this.KRV == 1) {
      this.VSPR = BigDecimal.ZERO;
    } else {
      if (this.ZRE4VP.compareTo(this.BBGRVALV) == 1) {
        this.ZRE4VPR = this.BBGRVALV;
      } else {
        this.ZRE4VPR = this.ZRE4VP;
      }
      this.VSPR = (this.ZRE4VPR.multiply(this.RVSATZAN)).setScale(2,BigDecimal.ROUND_DOWN);
    }
    this.MVSPKVPV();
    if (this.ALV == 1) {
    } else {
      if (this.STKL == 6) {
      } else {
        this.MVSPHB();
      }
    }
  }
  MVSPKVPV() {
    if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) {
      this.ZRE4VPR = this.BBGKVPV;
    } else {
      this.ZRE4VPR = this.ZRE4VP;
    }
    if (this.PKV > 0) {
      if (this.STKL == 6) {
        this.VSPKVPV = BigDecimal.ZERO;
      } else {
        this.PKPVAGZJ = this.PKPVAGZ.multiply(this.ZAHL12).divide(this.ZAHL100).setScale(2,BigDecimal.ROUND_DOWN);
        this.VSPKVPV = this.PKPV.multiply(this.ZAHL12).divide(this.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
        this.VSPKVPV = this.VSPKVPV.subtract(this.PKPVAGZJ);
        if (this.VSPKVPV.compareTo(BigDecimal.ZERO) == -1) {
          this.VSPKVPV = BigDecimal.ZERO;
        }
      }
    } else {
      this.VSPKVPV = this.ZRE4VPR.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
    }
    this.VSP = this.VSPKVPV.add(this.VSPR).setScale(0, BigDecimal.ROUND_UP);
  }
  MVSPHB() {
    if (this.ZRE4VP.compareTo(this.BBGRVALV) == 1) {
      this.ZRE4VPR = this.BBGRVALV;
    } else {
      this.ZRE4VPR = this.ZRE4VP;
    }
    this.VSPALV = this.AVSATZAN.multiply(this.ZRE4VPR).setScale(2, BigDecimal.ROUND_DOWN);
    this.VSPHB = this.VSPALV.add(this.VSPKVPV).setScale(2, BigDecimal.ROUND_DOWN);
    if (this.VSPHB.compareTo(BigDecimal.valueOf(1900)) == 1) {
      this.VSPHB = BigDecimal.valueOf(1900);
    }
    this.VSPN = this.VSPR.add(this.VSPHB).setScale(0, BigDecimal.ROUND_UP);
    if (this.VSPN.compareTo(this.VSP) == 1) {
      this.VSP = this.VSPN;
    }
  }
  MST5_6() {
    this.ZZX= this.X;
    if (this.ZZX.compareTo(this.W2STKL5) == 1) {
      this.ZX= this.W2STKL5;
      this.UP5_6();
      if (this.ZZX.compareTo (this.W3STKL5) == 1) {
        this.ST= (this.ST.add ((this.W3STKL5.subtract (this.W2STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        this.ST= (this.ST.add ((this.ZZX.subtract (this.W3STKL5)).multiply (BigDecimal.valueOf(0.45)))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        this.ST= (this.ST.add ((this.ZZX.subtract (this.W2STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
      }
    } else {
      this.ZX= this.ZZX;
      this.UP5_6();
      if (this.ZZX.compareTo (this.W1STKL5) == 1) {
        this.VERGL= this.ST;
        this.ZX= this.W1STKL5;
        this.UP5_6();
        this.HOCH= (this.ST.add ((this.ZZX.subtract (this.W1STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        if (this.HOCH.compareTo (this.VERGL) == -1) {
          this.ST= this.HOCH;
        } else {
          this.ST= this.VERGL;
        }
      }
    }
  }
  UP5_6() {
    this.X= (this.ZX.multiply (BigDecimal.valueOf(1.25))).setScale (0, BigDecimal.ROUND_DOWN);
    this.UPTAB26();
    this.ST1= this.ST;
    this.X= (this.ZX.multiply (BigDecimal.valueOf(0.75))).setScale (0, BigDecimal.ROUND_DOWN);
    this.UPTAB26();
    this.ST2= this.ST;
    this.DIFF= (this.ST1.subtract (this.ST2)).multiply (this.ZAHL2);
    this.MIST= (this.ZX.multiply (BigDecimal.valueOf(0.14))).setScale (0, BigDecimal.ROUND_DOWN);
    if (this.MIST.compareTo (this.DIFF) == 1) {
      this.ST= this.MIST;
    } else {
      this.ST= this.DIFF;
    }
  }
  MSOLZ() {
    this.SOLZFREI = (this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB)));
    if (this.JBMG.compareTo (this.SOLZFREI) == 1) {
      this.SOLZJ= (this.JBMG.multiply (BigDecimal.valueOf(5.5))).divide(this.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
      this.SOLZMIN= (this.JBMG.subtract (this.SOLZFREI)).multiply (BigDecimal.valueOf(11.9)).divide (this.ZAHL100).setScale (2, BigDecimal.ROUND_DOWN);
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
    this.LZZ = 1;
    if (this.ZMVB == 0) {
      this.ZMVB = 12;
    }
    if (this.SONSTB.compareTo (BigDecimal.ZERO) == 0 && this.MBV.compareTo (BigDecimal.ZERO) == 0) {
      this.LSTSO= BigDecimal.ZERO;
      this.STS= BigDecimal.ZERO;
      this.SOLZS= BigDecimal.ZERO;
      this.BKS= BigDecimal.ZERO;
    } else {
      this.MOSONST();
      this.ZRE4J= ((this.JRE4.add (this.SONSTB)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.ZVBEZJ= ((this.JVBEZ.add (this.VBS)).divide (this.ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      this.VBEZBSO= this.STERBE;
      this.MRE4SONST();
      this.MLSTJAHR();
      this.WVFRBM = (this.ZVE.subtract(this.GFB)).multiply(this.ZAHL100).setScale(2,BigDecimal.ROUND_DOWN);
      if (this.WVFRBM.compareTo(BigDecimal.ZERO) == -1) {
        this.WVFRBM = BigDecimal.ZERO;
      }
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
      this.UPTAB26();
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
  UPTAB26() {
    if (this.X.compareTo(this.GFB.add(this.ZAHL1)) == -1) {
      this.ST= BigDecimal.ZERO;
    } else {
      if (this.X.compareTo (BigDecimal.valueOf(17800)) == -1) {
        this.Y = (this.X.subtract(this.GFB)).divide(this.ZAHL10000, 6,BigDecimal.ROUND_DOWN);
        this.RW= this.Y.multiply (BigDecimal.valueOf(914.51));
        this.RW= this.RW.add (BigDecimal.valueOf(1400));
        this.ST= (this.RW.multiply (this.Y)).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (this.X.compareTo (BigDecimal.valueOf(69879)) == -1) {
          this.Y= (this.X.subtract (BigDecimal.valueOf(17799))).divide (this.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
          this.RW= this.Y.multiply (BigDecimal.valueOf(173.1));
          this.RW= this.RW.add (BigDecimal.valueOf(2397));
          this.RW= this.RW.multiply (this.Y);
          this.ST= (this.RW.add (BigDecimal.valueOf(1034.87))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (this.X.compareTo (BigDecimal.valueOf(277826)) == -1) {
            this.ST= ((this.X.multiply (BigDecimal.valueOf(0.42))).subtract (BigDecimal.valueOf(11135.63))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            this.ST= ((this.X.multiply (BigDecimal.valueOf(0.45))).subtract (BigDecimal.valueOf(19470.38))).setScale (0, BigDecimal.ROUND_DOWN);
          }
        }
      }
    }
    this.ST= this.ST.multiply (BigDecimal.valueOf(this.KZTAB));
  }
}
Lohnsteuer2026.YEAR = 2026;
