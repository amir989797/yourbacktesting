import { registerDefaultMlModelFactory, type ZigZagMlModel } from './zigzagMlEngine';

// Verified v4 Multi-Regime Champion Model (Structural 3.5 ATR ZigZag + 58 Causal Features):
// - Trained on 178 liquid XT.COM USDT perpetuals over 90 days (4.38M real 5m candles: Bull Train / Bear-Start Val / Crash OOS)
// - Auto-stopped via shift-invariant Validation ranking early stopping (42 depth-3 trees; zero OOS peeking)
// - Strictly causal extraction, zero lookahead, candle-close entry, next-bar exit, full XT fees (0.06%+0.06%) + 0.04% SL slippage
// - Verified Out-Of-Sample on Recent 1 Month (179 coins): 1-POS WR 61.8% / PF 1.69 (DD 3.6%), Multi-POS WR 63.6% / PF 2.07 (+$15,451)
// - Verified on 44 Brand-New Never-Seen XT.COM coins (ranks 181-225, recent 1M): 1-POS PF 1.23, Multi-POS WR 57.1% / PF 1.45
export const PRETRAINED_XT_5M_ML_MODEL: ZigZagMlModel = {
  "id": "pretrained_xt_5m_zigzag_gbdt_v4",
  "name": "XT.COM 5m ZigZag GBDT v4 (Structural 3.5A Multi-Regime Champion)",
  "version": 4,
  "exchange": "xt",
  "timeframe": "5m",
  "datasetId": "xt_5m_multi_regime_90d_180c",
  "createdAt": "2026-11-26T20:06:43.555Z",
  "zigzagParams": {
    "atrPeriod": 17,
    "minCandles": 4,
    "atrMultiplier": 3.5,
    "minCandlesForLongLeg": 12,
    "longLegAtrMultiplier": 15,
    "minCandlesForBlueLeg": 7,
    "blueLegAtrMultiplier": 4.75,
    "maxBlueLegPercent": 95,
    "maxBreakoutAtrMultiplier": 4
  },
  "slAtrMult": 5,
  "minSlPct": 3.5,
  "tpAtrMult": 7.5,
  "targetRR": 1.5,
  "timeStopCandles": 180,
  "minAtrPct": 0.25,
  "minStretchPct": 0,
  "baseScore": -0.30664,
  "learningRate": 0.05,
  "maxDepth": 3,
  "l2Lambda": 400,
  "objective": "win_prob",
  "sideFilter": "SELL",
  "scoreThreshold": 0.45927,
  "topPercent": 4,
  "featureNames": [
    "atrPct",
    "confirmDistAtr",
    "confirmBody",
    "l1_type",
    "l2_type",
    "giantCnt4",
    "blueCnt4",
    "whiteStreak",
    "l1_atr",
    "l1_pct",
    "l1_speed",
    "r12",
    "r13",
    "imp_vs_corr",
    "harm_XD",
    "harm_XB",
    "harm_BestErr",
    "vol_1v2",
    "vol_1v3",
    "volTot_1v3",
    "volGr_1",
    "vol_p1_climax",
    "p1_brk_p3",
    "brk_depth_p3",
    "rsi_conf",
    "rsi_p1",
    "rsi_div",
    "ema50_ext_pct",
    "ema200_ext_pct",
    "ema600_ext_pct",
    "ema600_slope_dir",
    "ret4h_stretch",
    "ret24h_stretch",
    "atr_expansion",
    "isLong",
    "ret15m_stretch",
    "ret1h_stretch",
    "wick_for",
    "wick_against",
    "confirm_vol_ratio",
    "range_pos_24h",
    "range_width_24h_pct",
    "dollar_vol_log",
    "bb_z_signed",
    "rebound_ratio",
    "rsi_cool",
    "ema200_ext_atr",
    "ema600_ext_atr",
    "vol_surge_4h_24h",
    "active_bar_ratio_48",
    "ema50_200_spread_atr",
    "p1_to_ema50_atr",
    "er_48",
    "er_288",
    "ema200_slope_dir",
    "trend_bar_ratio_48",
    "pullback_vs_stretch",
    "dist_from_ema50_signed_atr"
  ],
  "trees": [
    {
      "isLeaf": false,
      "v": 0,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.07727,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.00779
        },
        "r": {
          "isLeaf": false,
          "v": 0.08468,
          "f": 15,
          "th": 0.52988,
          "l": {
            "isLeaf": true,
            "v": -0.00525
          },
          "r": {
            "isLeaf": true,
            "v": 0.09159
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05665,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.07918,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00713
          },
          "r": {
            "isLeaf": true,
            "v": -0.09592
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00939,
          "f": 54,
          "th": -1.59695,
          "l": {
            "isLeaf": true,
            "v": -0.01562
          },
          "r": {
            "isLeaf": true,
            "v": 0.02358
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00004,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.04444,
        "f": 38,
        "th": 0.46154,
        "l": {
          "isLeaf": false,
          "v": -0.06086,
          "f": 48,
          "th": 1.04615,
          "l": {
            "isLeaf": true,
            "v": -0.06749
          },
          "r": {
            "isLeaf": true,
            "v": 0.00319
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01467,
          "f": 19,
          "th": 1.31802,
          "l": {
            "isLeaf": true,
            "v": 0.02371
          },
          "r": {
            "isLeaf": true,
            "v": -0.00916
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.0451,
        "f": 0,
        "th": 0.45408,
        "l": {
          "isLeaf": false,
          "v": 0.07652,
          "f": 17,
          "th": 2.40548,
          "l": {
            "isLeaf": true,
            "v": 0.08387
          },
          "r": {
            "isLeaf": true,
            "v": -0.00583
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01833,
          "f": 37,
          "th": 0,
          "l": {
            "isLeaf": true,
            "v": 0.01252
          },
          "r": {
            "isLeaf": true,
            "v": -0.03125
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00012,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.07523,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00381,
          "f": 38,
          "th": 0.08333,
          "l": {
            "isLeaf": true,
            "v": -0.01806
          },
          "r": {
            "isLeaf": true,
            "v": 0.01332
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.08666,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.09348
          },
          "r": {
            "isLeaf": true,
            "v": -0.00632
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05503,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.07716,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00724
          },
          "r": {
            "isLeaf": true,
            "v": -0.09369
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00941,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.03194
          },
          "r": {
            "isLeaf": true,
            "v": -0.0252
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00016,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.07385,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00382,
          "f": 38,
          "th": 0.08333,
          "l": {
            "isLeaf": true,
            "v": -0.01801
          },
          "r": {
            "isLeaf": true,
            "v": 0.01325
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.08513,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.0919
          },
          "r": {
            "isLeaf": true,
            "v": -0.0063
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05399,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00919,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.03071
          },
          "r": {
            "isLeaf": true,
            "v": -0.02406
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.07548,
          "f": 54,
          "th": 0.82381,
          "l": {
            "isLeaf": true,
            "v": -0.0894
          },
          "r": {
            "isLeaf": true,
            "v": 0.00191
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00015,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.07249,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00383,
          "f": 37,
          "th": 0.1,
          "l": {
            "isLeaf": true,
            "v": 0.00953
          },
          "r": {
            "isLeaf": true,
            "v": -0.01395
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.08363,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.09034
          },
          "r": {
            "isLeaf": true,
            "v": -0.00629
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05303,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.07439,
          "f": 47,
          "th": -11.96877,
          "l": {
            "isLeaf": true,
            "v": 0.00934
          },
          "r": {
            "isLeaf": true,
            "v": -0.08641
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.0091,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.03132
          },
          "r": {
            "isLeaf": true,
            "v": -0.02487
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00029,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.07117,
        "f": 11,
        "th": 2.44118,
        "l": {
          "isLeaf": false,
          "v": 0.07824,
          "f": 15,
          "th": 0.52988,
          "l": {
            "isLeaf": true,
            "v": -0.00414
          },
          "r": {
            "isLeaf": true,
            "v": 0.08376
          }
        },
        "r": {
          "isLeaf": true,
          "v": -0.00817
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05189,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.07277,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00767
          },
          "r": {
            "isLeaf": true,
            "v": -0.08902
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00886,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02711
          },
          "r": {
            "isLeaf": true,
            "v": -0.0229
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00018,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06967,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00435,
          "f": 37,
          "th": 0.1,
          "l": {
            "isLeaf": true,
            "v": 0.00917
          },
          "r": {
            "isLeaf": true,
            "v": -0.01414
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.08089,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.0875
          },
          "r": {
            "isLeaf": true,
            "v": -0.00626
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05095,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00873,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02995
          },
          "r": {
            "isLeaf": true,
            "v": -0.02377
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.07129,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00803
          },
          "r": {
            "isLeaf": true,
            "v": -0.08754
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00022,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06839,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00434,
          "f": 24,
          "th": 41.7657,
          "l": {
            "isLeaf": true,
            "v": -0.0133
          },
          "r": {
            "isLeaf": true,
            "v": 0.00821
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.07946,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.08602
          },
          "r": {
            "isLeaf": true,
            "v": -0.00625
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04998,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.07007,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00752
          },
          "r": {
            "isLeaf": true,
            "v": -0.08583
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.0085,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.03041
          },
          "r": {
            "isLeaf": true,
            "v": -0.02459
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00024,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06713,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00434,
          "f": 38,
          "th": 0.08333,
          "l": {
            "isLeaf": true,
            "v": -0.01816
          },
          "r": {
            "isLeaf": true,
            "v": 0.01284
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.07805,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.08606
          },
          "r": {
            "isLeaf": true,
            "v": -0.00285
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04904,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00842,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02935
          },
          "r": {
            "isLeaf": true,
            "v": -0.02346
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.06864,
          "f": 47,
          "th": -11.96877,
          "l": {
            "isLeaf": true,
            "v": 0.0086
          },
          "r": {
            "isLeaf": true,
            "v": -0.07963
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00044,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.04095,
        "f": 38,
        "th": 0.46154,
        "l": {
          "isLeaf": false,
          "v": -0.05733,
          "f": 14,
          "th": 0.35038,
          "l": {
            "isLeaf": true,
            "v": 0.00444
          },
          "r": {
            "isLeaf": true,
            "v": -0.06566
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01529,
          "f": 19,
          "th": 1.31802,
          "l": {
            "isLeaf": true,
            "v": 0.02423
          },
          "r": {
            "isLeaf": true,
            "v": -0.00902
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.04224,
        "f": 0,
        "th": 0.45408,
        "l": {
          "isLeaf": false,
          "v": 0.07036,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00457
          },
          "r": {
            "isLeaf": true,
            "v": 0.07746
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01585,
          "f": 37,
          "th": 0,
          "l": {
            "isLeaf": true,
            "v": 0.01325
          },
          "r": {
            "isLeaf": true,
            "v": -0.02912
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.0006,
      "f": 48,
      "th": 0.80956,
      "l": {
        "isLeaf": false,
        "v": -0.04349,
        "f": 30,
        "th": -0.71618,
        "l": {
          "isLeaf": false,
          "v": 0.01558,
          "f": 20,
          "th": 0.04873,
          "l": {
            "isLeaf": true,
            "v": -0.00136
          },
          "r": {
            "isLeaf": true,
            "v": 0.01768
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.05648,
          "f": 15,
          "th": 1.79493,
          "l": {
            "isLeaf": true,
            "v": -0.06289
          },
          "r": {
            "isLeaf": true,
            "v": 0.00531
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.034,
        "f": 0,
        "th": 0.45408,
        "l": {
          "isLeaf": false,
          "v": 0.06916,
          "f": 9,
          "th": 3.83399,
          "l": {
            "isLeaf": true,
            "v": 0.07704
          },
          "r": {
            "isLeaf": true,
            "v": -0.00596
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.02824,
          "f": 19,
          "th": 4.98635,
          "l": {
            "isLeaf": true,
            "v": -0.03808
          },
          "r": {
            "isLeaf": true,
            "v": 0.01217
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00063,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06504,
        "f": 11,
        "th": 2.44118,
        "l": {
          "isLeaf": false,
          "v": 0.07207,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00203
          },
          "r": {
            "isLeaf": true,
            "v": 0.08185
          }
        },
        "r": {
          "isLeaf": true,
          "v": -0.00837
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04702,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.06643,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00796
          },
          "r": {
            "isLeaf": true,
            "v": -0.08201
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00861,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02664
          },
          "r": {
            "isLeaf": true,
            "v": -0.02265
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00062,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06385,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00369,
          "f": 37,
          "th": 0.1,
          "l": {
            "isLeaf": true,
            "v": 0.00952
          },
          "r": {
            "isLeaf": true,
            "v": -0.01378
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.07389,
          "f": 18,
          "th": 0.50708,
          "l": {
            "isLeaf": true,
            "v": -0.00306
          },
          "r": {
            "isLeaf": true,
            "v": 0.07784
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04618,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00847,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02905
          },
          "r": {
            "isLeaf": true,
            "v": -0.02306
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.06508,
          "f": 28,
          "th": -1.76205,
          "l": {
            "isLeaf": true,
            "v": 0.00475
          },
          "r": {
            "isLeaf": true,
            "v": -0.0792
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00062,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.0627,
        "f": 11,
        "th": 2.44118,
        "l": {
          "isLeaf": false,
          "v": 0.06975,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00201
          },
          "r": {
            "isLeaf": true,
            "v": 0.07924
          }
        },
        "r": {
          "isLeaf": true,
          "v": -0.00851
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04534,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.06402,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00795
          },
          "r": {
            "isLeaf": true,
            "v": -0.07924
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00825,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02951
          },
          "r": {
            "isLeaf": true,
            "v": -0.02387
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00064,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.03873,
        "f": 44,
        "th": 0.41906,
        "l": {
          "isLeaf": false,
          "v": 0.00935,
          "f": 18,
          "th": 0.50708,
          "l": {
            "isLeaf": true,
            "v": -0.01081
          },
          "r": {
            "isLeaf": true,
            "v": 0.01962
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.04902,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.0072
          },
          "r": {
            "isLeaf": true,
            "v": -0.05978
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.04027,
        "f": 0,
        "th": 0.45408,
        "l": {
          "isLeaf": false,
          "v": 0.06636,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00421
          },
          "r": {
            "isLeaf": true,
            "v": 0.07298
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01438,
          "f": 33,
          "th": 1.45072,
          "l": {
            "isLeaf": true,
            "v": -0.0261
          },
          "r": {
            "isLeaf": true,
            "v": 0.01347
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00081,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.06128,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.0096
        },
        "r": {
          "isLeaf": false,
          "v": 0.06933,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.07686
          },
          "r": {
            "isLeaf": true,
            "v": -0.0086
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04407,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.06226,
          "f": 47,
          "th": -11.96877,
          "l": {
            "isLeaf": true,
            "v": 0.00969
          },
          "r": {
            "isLeaf": true,
            "v": -0.07357
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00806,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02913
          },
          "r": {
            "isLeaf": true,
            "v": -0.02368
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00077,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.05991,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.00958
        },
        "r": {
          "isLeaf": false,
          "v": 0.06789,
          "f": 15,
          "th": 0.52988,
          "l": {
            "isLeaf": true,
            "v": -0.00673
          },
          "r": {
            "isLeaf": true,
            "v": 0.0751
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04312,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00809,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02585
          },
          "r": {
            "isLeaf": true,
            "v": -0.02224
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.06093,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00851
          },
          "r": {
            "isLeaf": true,
            "v": -0.07609
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00065,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.05094,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00699,
          "f": 2,
          "th": 0.6,
          "l": {
            "isLeaf": true,
            "v": 0.01465
          },
          "r": {
            "isLeaf": true,
            "v": -0.0224
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.06406,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.07436
          },
          "r": {
            "isLeaf": true,
            "v": -0.00632
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04901,
        "f": 20,
        "th": 0.71557,
        "l": {
          "isLeaf": false,
          "v": -0.05938,
          "f": 5,
          "th": 0,
          "l": {
            "isLeaf": true,
            "v": -0.07079
          },
          "r": {
            "isLeaf": true,
            "v": 0.00457
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00636,
          "f": 43,
          "th": 0.20734,
          "l": {
            "isLeaf": true,
            "v": 0.02108
          },
          "r": {
            "isLeaf": true,
            "v": -0.01494
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00062,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.0577,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.00969
        },
        "r": {
          "isLeaf": false,
          "v": 0.06568,
          "f": 15,
          "th": 0.52988,
          "l": {
            "isLeaf": true,
            "v": -0.0068
          },
          "r": {
            "isLeaf": true,
            "v": 0.07284
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04171,
        "f": 30,
        "th": -0.38171,
        "l": {
          "isLeaf": false,
          "v": 0.00225,
          "f": 50,
          "th": 4.67097,
          "l": {
            "isLeaf": true,
            "v": 0.01908
          },
          "r": {
            "isLeaf": true,
            "v": -0.02027
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.05601,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00794
          },
          "r": {
            "isLeaf": true,
            "v": -0.07046
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00047,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04909,
        "f": 18,
        "th": 0.61657,
        "l": {
          "isLeaf": false,
          "v": -0.00796,
          "f": 47,
          "th": 2.58596,
          "l": {
            "isLeaf": true,
            "v": -0.01899
          },
          "r": {
            "isLeaf": true,
            "v": 0.01106
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05912,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.07064
          },
          "r": {
            "isLeaf": true,
            "v": -0.00832
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04749,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.05758,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.06826
          },
          "r": {
            "isLeaf": true,
            "v": 0.00529
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.0122,
          "f": 9,
          "th": 3.83399,
          "l": {
            "isLeaf": true,
            "v": 0.01948
          },
          "r": {
            "isLeaf": true,
            "v": -0.00699
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00051,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.0555,
        "f": 17,
        "th": 1.75711,
        "l": {
          "isLeaf": false,
          "v": 0.06455,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00338
          },
          "r": {
            "isLeaf": true,
            "v": 0.07456
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00698,
          "f": 52,
          "th": 0.06881,
          "l": {
            "isLeaf": true,
            "v": 0.00717
          },
          "r": {
            "isLeaf": true,
            "v": -0.01406
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04026,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00873,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02852
          },
          "r": {
            "isLeaf": true,
            "v": -0.02211
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.05784,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00882
          },
          "r": {
            "isLeaf": true,
            "v": -0.07281
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00059,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04744,
        "f": 17,
        "th": 1.75711,
        "l": {
          "isLeaf": false,
          "v": 0.05644,
          "f": 33,
          "th": 1.02673,
          "l": {
            "isLeaf": true,
            "v": 0.00012
          },
          "r": {
            "isLeaf": true,
            "v": 0.07233
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00766,
          "f": 19,
          "th": 4.98635,
          "l": {
            "isLeaf": true,
            "v": -0.017
          },
          "r": {
            "isLeaf": true,
            "v": 0.00996
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04571,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.05571,
          "f": 33,
          "th": 1.45072,
          "l": {
            "isLeaf": true,
            "v": -0.06309
          },
          "r": {
            "isLeaf": true,
            "v": 0.00975
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01223,
          "f": 31,
          "th": 0.4008,
          "l": {
            "isLeaf": true,
            "v": 0.01993
          },
          "r": {
            "isLeaf": true,
            "v": -0.00755
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00096,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.05392,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.00999
        },
        "r": {
          "isLeaf": false,
          "v": 0.06197,
          "f": 32,
          "th": 3.29861,
          "l": {
            "isLeaf": true,
            "v": 0.06842
          },
          "r": {
            "isLeaf": true,
            "v": -0.00567
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03852,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.05613,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00857
          },
          "r": {
            "isLeaf": true,
            "v": -0.07072
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00915,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.0294
          },
          "r": {
            "isLeaf": true,
            "v": -0.02258
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00087,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.03562,
        "f": 38,
        "th": 0.46154,
        "l": {
          "isLeaf": false,
          "v": -0.0523,
          "f": 15,
          "th": 0.63265,
          "l": {
            "isLeaf": true,
            "v": 0.00523
          },
          "r": {
            "isLeaf": true,
            "v": -0.0631
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01678,
          "f": 19,
          "th": 1.31802,
          "l": {
            "isLeaf": true,
            "v": 0.02545
          },
          "r": {
            "isLeaf": true,
            "v": -0.00863
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03744,
        "f": 55,
        "th": -0.10204,
        "l": {
          "isLeaf": false,
          "v": -0.01766,
          "f": 15,
          "th": 1.31875,
          "l": {
            "isLeaf": true,
            "v": -0.02721
          },
          "r": {
            "isLeaf": true,
            "v": 0.00796
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05682,
          "f": 50,
          "th": 4.67097,
          "l": {
            "isLeaf": true,
            "v": 0.06473
          },
          "r": {
            "isLeaf": true,
            "v": -0.01048
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00073,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04565,
        "f": 10,
        "th": 0.19296,
        "l": {
          "isLeaf": false,
          "v": -0.00971,
          "f": 15,
          "th": 1.01807,
          "l": {
            "isLeaf": true,
            "v": -0.01981
          },
          "r": {
            "isLeaf": true,
            "v": 0.00953
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05522,
          "f": 12,
          "th": 0.3578,
          "l": {
            "isLeaf": true,
            "v": -0.01185
          },
          "r": {
            "isLeaf": true,
            "v": 0.06311
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04377,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.05369,
          "f": 35,
          "th": -1.59363,
          "l": {
            "isLeaf": true,
            "v": 0.00569
          },
          "r": {
            "isLeaf": true,
            "v": -0.06059
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.0123,
          "f": 31,
          "th": 0.4008,
          "l": {
            "isLeaf": true,
            "v": 0.01991
          },
          "r": {
            "isLeaf": true,
            "v": -0.00746
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00067,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.05138,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.01009
        },
        "r": {
          "isLeaf": false,
          "v": 0.05941,
          "f": 23,
          "th": 4.17267,
          "l": {
            "isLeaf": true,
            "v": 0.06779
          },
          "r": {
            "isLeaf": true,
            "v": -0.00653
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03706,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.00966,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02876
          },
          "r": {
            "isLeaf": true,
            "v": -0.02118
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.05455,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00905
          },
          "r": {
            "isLeaf": true,
            "v": -0.06923
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00061,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.03452,
        "f": 44,
        "th": 0.41906,
        "l": {
          "isLeaf": false,
          "v": 0.00981,
          "f": 18,
          "th": 0.50708,
          "l": {
            "isLeaf": true,
            "v": -0.01054
          },
          "r": {
            "isLeaf": true,
            "v": 0.01985
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.04465,
          "f": 14,
          "th": 0.35038,
          "l": {
            "isLeaf": true,
            "v": 0.00848
          },
          "r": {
            "isLeaf": true,
            "v": -0.05578
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03591,
        "f": 55,
        "th": -0.10204,
        "l": {
          "isLeaf": false,
          "v": -0.01758,
          "f": 15,
          "th": 1.31875,
          "l": {
            "isLeaf": true,
            "v": -0.02707
          },
          "r": {
            "isLeaf": true,
            "v": 0.00791
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05497,
          "f": 0,
          "th": 0.55534,
          "l": {
            "isLeaf": true,
            "v": 0.06747
          },
          "r": {
            "isLeaf": true,
            "v": -0.00655
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00064,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04347,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00812,
          "f": 2,
          "th": 0.6,
          "l": {
            "isLeaf": true,
            "v": 0.01381
          },
          "r": {
            "isLeaf": true,
            "v": -0.02283
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05623,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.06664
          },
          "r": {
            "isLeaf": true,
            "v": -0.00746
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04179,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.05164,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.06252
          },
          "r": {
            "isLeaf": true,
            "v": 0.00659
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01239,
          "f": 31,
          "th": 0.4008,
          "l": {
            "isLeaf": true,
            "v": 0.01991
          },
          "r": {
            "isLeaf": true,
            "v": -0.00736
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00072,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.03337,
        "f": 43,
        "th": -0.94507,
        "l": {
          "isLeaf": false,
          "v": -0.04711,
          "f": 7,
          "th": 1,
          "l": {
            "isLeaf": true,
            "v": 0.004
          },
          "r": {
            "isLeaf": true,
            "v": -0.05267
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00859,
          "f": 10,
          "th": 0.24477,
          "l": {
            "isLeaf": true,
            "v": -0.01255
          },
          "r": {
            "isLeaf": true,
            "v": 0.01999
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.0349,
        "f": 9,
        "th": 3.83399,
        "l": {
          "isLeaf": false,
          "v": 0.0558,
          "f": 8,
          "th": 10.31642,
          "l": {
            "isLeaf": true,
            "v": 0.06143
          },
          "r": {
            "isLeaf": true,
            "v": -0.00694
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01447,
          "f": 33,
          "th": 1.45072,
          "l": {
            "isLeaf": true,
            "v": -0.0302
          },
          "r": {
            "isLeaf": true,
            "v": 0.0177
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.0007,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.04892,
        "f": 17,
        "th": 1.75711,
        "l": {
          "isLeaf": false,
          "v": 0.05835,
          "f": 48,
          "th": 0.80956,
          "l": {
            "isLeaf": true,
            "v": -0.00418
          },
          "r": {
            "isLeaf": true,
            "v": 0.0683
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00822,
          "f": 53,
          "th": 0.02064,
          "l": {
            "isLeaf": true,
            "v": 0.00627
          },
          "r": {
            "isLeaf": true,
            "v": -0.01451
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03522,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.05259,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00881
          },
          "r": {
            "isLeaf": true,
            "v": -0.06687
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00992,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02727
          },
          "r": {
            "isLeaf": true,
            "v": -0.02166
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00072,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04177,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00776,
          "f": 38,
          "th": 0.46154,
          "l": {
            "isLeaf": true,
            "v": -0.01922
          },
          "r": {
            "isLeaf": true,
            "v": 0.01271
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05399,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.06424
          },
          "r": {
            "isLeaf": true,
            "v": -0.00751
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04002,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.04975,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.06047
          },
          "r": {
            "isLeaf": true,
            "v": 0.00668
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01237,
          "f": 31,
          "th": 0.4008,
          "l": {
            "isLeaf": true,
            "v": 0.01982
          },
          "r": {
            "isLeaf": true,
            "v": -0.00729
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00083,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.04735,
        "f": 17,
        "th": 1.75711,
        "l": {
          "isLeaf": false,
          "v": 0.0566,
          "f": 33,
          "th": 1.02673,
          "l": {
            "isLeaf": true,
            "v": 0.00002
          },
          "r": {
            "isLeaf": true,
            "v": 0.06799
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00813,
          "f": 52,
          "th": 0.06881,
          "l": {
            "isLeaf": true,
            "v": 0.00669
          },
          "r": {
            "isLeaf": true,
            "v": -0.01479
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.0339,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.05103,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00894
          },
          "r": {
            "isLeaf": true,
            "v": -0.06517
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01004,
          "f": 32,
          "th": 9.30073,
          "l": {
            "isLeaf": true,
            "v": 0.02944
          },
          "r": {
            "isLeaf": true,
            "v": -0.02148
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00098,
      "f": 48,
      "th": 0.80956,
      "l": {
        "isLeaf": false,
        "v": -0.03332,
        "f": 30,
        "th": -0.71618,
        "l": {
          "isLeaf": false,
          "v": 0.01663,
          "f": 20,
          "th": 0.04873,
          "l": {
            "isLeaf": true,
            "v": -0.00067
          },
          "r": {
            "isLeaf": true,
            "v": 0.01809
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.04641,
          "f": 15,
          "th": 1.79493,
          "l": {
            "isLeaf": true,
            "v": -0.05345
          },
          "r": {
            "isLeaf": true,
            "v": 0.00697
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02669,
        "f": 9,
        "th": 3.83399,
        "l": {
          "isLeaf": false,
          "v": 0.0524,
          "f": 32,
          "th": 3.29861,
          "l": {
            "isLeaf": true,
            "v": 0.06196
          },
          "r": {
            "isLeaf": true,
            "v": -0.00491
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.02491,
          "f": 14,
          "th": 3.83226,
          "l": {
            "isLeaf": true,
            "v": -0.03342
          },
          "r": {
            "isLeaf": true,
            "v": 0.00842
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00098,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.04019,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00711,
          "f": 2,
          "th": 0.6,
          "l": {
            "isLeaf": true,
            "v": 0.01419
          },
          "r": {
            "isLeaf": true,
            "v": -0.02207
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.05168,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.06176
          },
          "r": {
            "isLeaf": true,
            "v": -0.00756
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.0381,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.04776,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.05841
          },
          "r": {
            "isLeaf": true,
            "v": 0.00693
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01245,
          "f": 9,
          "th": 3.83399,
          "l": {
            "isLeaf": true,
            "v": 0.01935
          },
          "r": {
            "isLeaf": true,
            "v": -0.00659
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00106,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.0455,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.0107
        },
        "r": {
          "isLeaf": false,
          "v": 0.05371,
          "f": 11,
          "th": 2.44118,
          "l": {
            "isLeaf": true,
            "v": 0.06144
          },
          "r": {
            "isLeaf": true,
            "v": -0.00961
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03225,
        "f": 47,
        "th": 5.54883,
        "l": {
          "isLeaf": false,
          "v": -0.04924,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.00904
          },
          "r": {
            "isLeaf": true,
            "v": -0.06321
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01041,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02752
          },
          "r": {
            "isLeaf": true,
            "v": -0.02132
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00089,
      "f": 33,
      "th": 1.02673,
      "l": {
        "isLeaf": false,
        "v": -0.03098,
        "f": 38,
        "th": 0.46154,
        "l": {
          "isLeaf": false,
          "v": -0.04785,
          "f": 15,
          "th": 0.63265,
          "l": {
            "isLeaf": true,
            "v": 0.00697
          },
          "r": {
            "isLeaf": true,
            "v": -0.0594
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01798,
          "f": 19,
          "th": 1.31802,
          "l": {
            "isLeaf": true,
            "v": 0.02635
          },
          "r": {
            "isLeaf": true,
            "v": -0.00822
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03272,
        "f": 53,
        "th": 0.13904,
        "l": {
          "isLeaf": false,
          "v": 0.04668,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.06232
          },
          "r": {
            "isLeaf": true,
            "v": -0.0136
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.02127,
          "f": 50,
          "th": 2.24614,
          "l": {
            "isLeaf": true,
            "v": 0.00025
          },
          "r": {
            "isLeaf": true,
            "v": -0.02229
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00072,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.03832,
        "f": 10,
        "th": 0.19296,
        "l": {
          "isLeaf": false,
          "v": -0.01069,
          "f": 15,
          "th": 1.01807,
          "l": {
            "isLeaf": true,
            "v": -0.02017
          },
          "r": {
            "isLeaf": true,
            "v": 0.00884
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.04792,
          "f": 30,
          "th": 0.49909,
          "l": {
            "isLeaf": true,
            "v": 0.05463
          },
          "r": {
            "isLeaf": true,
            "v": -0.00948
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03666,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.04628,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.05676
          },
          "r": {
            "isLeaf": true,
            "v": 0.00693
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01253,
          "f": 31,
          "th": 0.4008,
          "l": {
            "isLeaf": true,
            "v": 0.01981
          },
          "r": {
            "isLeaf": true,
            "v": -0.00711
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00063,
      "f": 41,
      "th": 6.52077,
      "l": {
        "isLeaf": false,
        "v": 0.04319,
        "f": 53,
        "th": 0.06181,
        "l": {
          "isLeaf": false,
          "v": 0.05378,
          "f": 23,
          "th": 4.17267,
          "l": {
            "isLeaf": true,
            "v": 0.06327
          },
          "r": {
            "isLeaf": true,
            "v": -0.00996
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00819,
          "f": 13,
          "th": 1.32026,
          "l": {
            "isLeaf": true,
            "v": -0.01591
          },
          "r": {
            "isLeaf": true,
            "v": 0.00749
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03112,
        "f": 44,
        "th": 0.55425,
        "l": {
          "isLeaf": false,
          "v": 0.01074,
          "f": 53,
          "th": 0.13904,
          "l": {
            "isLeaf": true,
            "v": 0.02752
          },
          "r": {
            "isLeaf": true,
            "v": -0.02076
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.04794,
          "f": 46,
          "th": -4.53274,
          "l": {
            "isLeaf": true,
            "v": 0.0096
          },
          "r": {
            "isLeaf": true,
            "v": -0.06211
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00059,
      "f": 41,
      "th": 5.9587,
      "l": {
        "isLeaf": false,
        "v": 0.04562,
        "f": 11,
        "th": 1.88,
        "l": {
          "isLeaf": false,
          "v": 0.05321,
          "f": 54,
          "th": 0.55517,
          "l": {
            "isLeaf": true,
            "v": 0.05658
          },
          "r": {
            "isLeaf": true,
            "v": -0.00278
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.00711,
          "f": 17,
          "th": 1.47547,
          "l": {
            "isLeaf": true,
            "v": 0.00536
          },
          "r": {
            "isLeaf": true,
            "v": -0.01272
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02842,
        "f": 33,
        "th": 1.45072,
        "l": {
          "isLeaf": false,
          "v": -0.03789,
          "f": 40,
          "th": 0.22209,
          "l": {
            "isLeaf": true,
            "v": 0.01288
          },
          "r": {
            "isLeaf": true,
            "v": -0.052
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01823,
          "f": 26,
          "th": -9.00174,
          "l": {
            "isLeaf": true,
            "v": -0.00262
          },
          "r": {
            "isLeaf": true,
            "v": 0.02139
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00098,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.03646,
        "f": 10,
        "th": 0.19296,
        "l": {
          "isLeaf": false,
          "v": -0.01083,
          "f": 26,
          "th": 0.72704,
          "l": {
            "isLeaf": true,
            "v": -0.01943
          },
          "r": {
            "isLeaf": true,
            "v": 0.00794
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.04599,
          "f": 12,
          "th": 0.3578,
          "l": {
            "isLeaf": true,
            "v": -0.01219
          },
          "r": {
            "isLeaf": true,
            "v": 0.05388
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03446,
        "f": 5,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.04556,
          "f": 35,
          "th": -1.59363,
          "l": {
            "isLeaf": true,
            "v": 0.01227
          },
          "r": {
            "isLeaf": true,
            "v": -0.05621
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00843,
          "f": 16,
          "th": 0.38235,
          "l": {
            "isLeaf": true,
            "v": 0.02182
          },
          "r": {
            "isLeaf": true,
            "v": -0.01159
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00088,
      "f": 41,
      "th": 5.9587,
      "l": {
        "isLeaf": false,
        "v": 0.04401,
        "f": 8,
        "th": 4.05168,
        "l": {
          "isLeaf": true,
          "v": -0.01041
        },
        "r": {
          "isLeaf": false,
          "v": 0.05231,
          "f": 11,
          "th": 1.88,
          "l": {
            "isLeaf": true,
            "v": 0.06061
          },
          "r": {
            "isLeaf": true,
            "v": -0.00726
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02704,
        "f": 38,
        "th": 0.46154,
        "l": {
          "isLeaf": false,
          "v": -0.03845,
          "f": 44,
          "th": 0.55425,
          "l": {
            "isLeaf": true,
            "v": 0.00353
          },
          "r": {
            "isLeaf": true,
            "v": -0.05003
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01245,
          "f": 31,
          "th": 2.07021,
          "l": {
            "isLeaf": true,
            "v": 0.02038
          },
          "r": {
            "isLeaf": true,
            "v": -0.00893
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0.00096,
      "f": 41,
      "th": 7.77088,
      "l": {
        "isLeaf": false,
        "v": 0.03499,
        "f": 48,
        "th": 0.80956,
        "l": {
          "isLeaf": false,
          "v": -0.00835,
          "f": 2,
          "th": 0.6,
          "l": {
            "isLeaf": true,
            "v": 0.01324
          },
          "r": {
            "isLeaf": true,
            "v": -0.02253
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.04658,
          "f": 17,
          "th": 1.75711,
          "l": {
            "isLeaf": true,
            "v": 0.0568
          },
          "r": {
            "isLeaf": true,
            "v": -0.00842
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03305,
        "f": 4,
        "th": 0,
        "l": {
          "isLeaf": false,
          "v": -0.04258,
          "f": 20,
          "th": 0.71557,
          "l": {
            "isLeaf": true,
            "v": -0.05321
          },
          "r": {
            "isLeaf": true,
            "v": 0.00776
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01276,
          "f": 9,
          "th": 3.83399,
          "l": {
            "isLeaf": true,
            "v": 0.01946
          },
          "r": {
            "isLeaf": true,
            "v": -0.00637
          }
        }
      }
    }
  ],
  "featureImportance": [
    {
      "name": "range_width_24h_pct",
      "gain": 129.37,
      "weightPct": 42.47
    },
    {
      "name": "atr_expansion",
      "gain": 19.55,
      "weightPct": 6.42
    },
    {
      "name": "ema600_ext_atr",
      "gain": 17.85,
      "weightPct": 5.86
    },
    {
      "name": "ema200_ext_atr",
      "gain": 17.31,
      "weightPct": 5.68
    },
    {
      "name": "vol_surge_4h_24h",
      "gain": 15.38,
      "weightPct": 5.05
    },
    {
      "name": "rebound_ratio",
      "gain": 10.92,
      "weightPct": 3.59
    },
    {
      "name": "ret24h_stretch",
      "gain": 9.83,
      "weightPct": 3.23
    },
    {
      "name": "atrPct",
      "gain": 8.97,
      "weightPct": 2.94
    },
    {
      "name": "vol_1v2",
      "gain": 8.4,
      "weightPct": 2.76
    },
    {
      "name": "r12",
      "gain": 6.9,
      "weightPct": 2.27
    },
    {
      "name": "wick_against",
      "gain": 5.82,
      "weightPct": 1.91
    },
    {
      "name": "l2_type",
      "gain": 5.43,
      "weightPct": 1.78
    },
    {
      "name": "l1_atr",
      "gain": 5.26,
      "weightPct": 1.73
    },
    {
      "name": "er_288",
      "gain": 5.02,
      "weightPct": 1.65
    },
    {
      "name": "harm_XB",
      "gain": 4.89,
      "weightPct": 1.61
    },
    {
      "name": "volGr_1",
      "gain": 4.38,
      "weightPct": 1.44
    },
    {
      "name": "l1_pct",
      "gain": 3.83,
      "weightPct": 1.26
    },
    {
      "name": "ema600_slope_dir",
      "gain": 2.79,
      "weightPct": 0.92
    },
    {
      "name": "trend_bar_ratio_48",
      "gain": 2.47,
      "weightPct": 0.81
    },
    {
      "name": "l1_speed",
      "gain": 2.02,
      "weightPct": 0.66
    },
    {
      "name": "ema200_slope_dir",
      "gain": 1.4,
      "weightPct": 0.46
    },
    {
      "name": "harm_XD",
      "gain": 1.39,
      "weightPct": 0.46
    },
    {
      "name": "volTot_1v3",
      "gain": 1.36,
      "weightPct": 0.45
    },
    {
      "name": "r13",
      "gain": 1.3,
      "weightPct": 0.43
    },
    {
      "name": "vol_1v3",
      "gain": 1.3,
      "weightPct": 0.43
    },
    {
      "name": "giantCnt4",
      "gain": 1.2,
      "weightPct": 0.4
    },
    {
      "name": "brk_depth_p3",
      "gain": 1.18,
      "weightPct": 0.39
    },
    {
      "name": "ret15m_stretch",
      "gain": 1.17,
      "weightPct": 0.38
    },
    {
      "name": "confirmBody",
      "gain": 1.15,
      "weightPct": 0.38
    },
    {
      "name": "wick_for",
      "gain": 1.12,
      "weightPct": 0.37
    },
    {
      "name": "ema50_200_spread_atr",
      "gain": 1.04,
      "weightPct": 0.34
    },
    {
      "name": "range_pos_24h",
      "gain": 0.95,
      "weightPct": 0.31
    },
    {
      "name": "bb_z_signed",
      "gain": 0.91,
      "weightPct": 0.3
    },
    {
      "name": "ema200_ext_pct",
      "gain": 0.88,
      "weightPct": 0.29
    },
    {
      "name": "ret4h_stretch",
      "gain": 0.79,
      "weightPct": 0.26
    },
    {
      "name": "whiteStreak",
      "gain": 0.28,
      "weightPct": 0.09
    },
    {
      "name": "harm_BestErr",
      "gain": 0.24,
      "weightPct": 0.08
    },
    {
      "name": "rsi_div",
      "gain": 0.19,
      "weightPct": 0.06
    },
    {
      "name": "er_48",
      "gain": 0.17,
      "weightPct": 0.06
    },
    {
      "name": "imp_vs_corr",
      "gain": 0.1,
      "weightPct": 0.03
    },
    {
      "name": "rsi_conf",
      "gain": 0.1,
      "weightPct": 0.03
    },
    {
      "name": "confirmDistAtr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l1_type",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "blueCnt4",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "vol_p1_climax",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "p1_brk_p3",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_p1",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema50_ext_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema600_ext_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "isLong",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ret1h_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "confirm_vol_ratio",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "dollar_vol_log",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_cool",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "active_bar_ratio_48",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "p1_to_ema50_atr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "pullback_vs_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "dist_from_ema50_signed_atr",
      "gain": 0,
      "weightPct": 0
    }
  ],
  "metrics": {
    "totalSymbols": 178,
    "totalEvents": 34140,
    "train": {
      "totalSignals": 710,
      "winRate": 58.73,
      "avgR": 0.2086,
      "sumR": 148.13,
      "profitFactor": 1.78,
      "longCount": 0,
      "longAvgR": 0,
      "shortCount": 710,
      "shortAvgR": 0.2086,
      "portfolioTrades": 63,
      "portfolioWinRate": 61.9,
      "portfolioSumR": 13.47,
      "portfolioProfitFactor": 1.94,
      "portfolioMaxDdR": 3.15
    },
    "validation": {
      "totalSignals": 282,
      "winRate": 62.06,
      "avgR": 0.2667,
      "sumR": 75.2,
      "profitFactor": 2.16,
      "longCount": 0,
      "longAvgR": 0,
      "shortCount": 282,
      "shortAvgR": 0.2667,
      "portfolioTrades": 29,
      "portfolioWinRate": 55.17,
      "portfolioSumR": 3.81,
      "portfolioProfitFactor": 1.58,
      "portfolioMaxDdR": 3.47
    },
    "oos": {
      "totalSignals": 309,
      "winRate": 60.52,
      "avgR": 0.2325,
      "sumR": 71.83,
      "profitFactor": 2.04,
      "longCount": 0,
      "longAvgR": 0,
      "shortCount": 309,
      "shortAvgR": 0.2325,
      "portfolioTrades": 24,
      "portfolioWinRate": 62.5,
      "portfolioSumR": 4.28,
      "portfolioProfitFactor": 1.66,
      "portfolioMaxDdR": 2.09
    },
    "unseenSymbolsOos": {
      "totalSignals": 56,
      "winRate": 64.29,
      "avgR": 0.3126,
      "sumR": 17.51,
      "profitFactor": 2.9,
      "longCount": 0,
      "longAvgR": 0,
      "shortCount": 56,
      "shortAvgR": 0.3126,
      "portfolioTrades": 17,
      "portfolioWinRate": 58.82,
      "portfolioSumR": 3.96,
      "portfolioProfitFactor": 2.27,
      "portfolioMaxDdR": 2.16
    }
  },
  "discoveredPatterns": [
    {
      "name": "پولبک هم‌جهت روند قدرتمند (رژیم رونددار ER+EMA200)",
      "rule": "EMA200 Ext < -1% & EMA200 Slope > 0 & ER48 ≥ 0.25",
      "category": "structure",
      "trainCount": 24,
      "trainWinRate": 50,
      "trainAvgR": 0.036,
      "trainPf": 1.12,
      "oosCount": 9,
      "oosWinRate": 55.6,
      "oosAvgR": -0.053,
      "oosPf": 0.89
    },
    {
      "name": "کشیدگی شدید EMA600 + تایید پیوت زیگزاگ",
      "rule": "EMA600 Ext ≥ 6% & ML Score ≥ Threshold",
      "category": "structure",
      "trainCount": 2,
      "trainWinRate": 100,
      "trainAvgR": 1.467,
      "trainPf": 99,
      "oosCount": 0,
      "oosWinRate": 0,
      "oosAvgR": 0,
      "oosPf": 0
    },
    {
      "name": "ساختار هارمونیک و نسبت L1<L2,L3 (تخلیه موج)",
      "rule": "r12 < 1.0 or r13 < 1.0 & Harmonic Error < 0.45",
      "category": "harmonic",
      "trainCount": 686,
      "trainWinRate": 58.9,
      "trainAvgR": 0.212,
      "trainPf": 1.8,
      "oosCount": 295,
      "oosWinRate": 60.7,
      "oosAvgR": 0.233,
      "oosPf": 2.06
    },
    {
      "name": "بازگشت لگ غول‌پیکر (سبز/قرمز) با فیلتر جهت",
      "rule": "L1 = Giant (Green/Red) & ML Score ≥ Threshold",
      "category": "legs",
      "trainCount": 0,
      "trainWinRate": 0,
      "trainAvgR": 0,
      "trainPf": 0,
      "oosCount": 0,
      "oosWinRate": 0,
      "oosAvgR": 0,
      "oosPf": 0
    },
    {
      "name": "بازگشت لگ آبی استراتژی ۲ (CD/EF) با استاپ ضداسویپ",
      "rule": "L1 = Blue/Dark-Blue (CD/EF) & Anti-Sweep SL",
      "category": "legs",
      "trainCount": 13,
      "trainWinRate": 61.5,
      "trainAvgR": 0.162,
      "trainPf": 1.5,
      "oosCount": 2,
      "oosWinRate": 100,
      "oosAvgR": 0.96,
      "oosPf": 99
    },
    {
      "name": "کلایمکس یا تخلیه حجم لگ هم‌جهت + شکست کم‌عمق P3",
      "rule": "Vol(L1)/Vol(L3) < 0.85 or Climax > 1.8 & Sweep P3",
      "category": "volume",
      "trainCount": 170,
      "trainWinRate": 64.1,
      "trainAvgR": 0.395,
      "trainPf": 2.59,
      "oosCount": 56,
      "oosWinRate": 55.4,
      "oosAvgR": 0.186,
      "oosPf": 1.94
    }
  ],
  "isDefault": true
};

registerDefaultMlModelFactory(() => PRETRAINED_XT_5M_ML_MODEL);
