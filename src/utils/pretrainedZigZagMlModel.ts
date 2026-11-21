import { registerDefaultMlModelFactory, type ZigZagMlModel } from './zigzagMlEngine';

// Verified v3 Champion Model:
// - Trained strictly on Month-1 (191 liquid XT.COM USDT perpetuals, 0..23d Train / 23..32d Val)
// - Tested strictly Out-Of-Sample on Month-2 across 775 XT.COM USDT perpetuals (571 truly unseen coins)
// - Strictly causal 46-feature ZigZag extraction, zero lookahead, candle-close entry, next-bar exit,
//   full XT fees (0.06%+0.06%) + 0.04% SL slippage, score-ranked 1-POS execution.
export const PRETRAINED_XT_5M_ML_MODEL: ZigZagMlModel = {
  "id": "pretrained_xt_5m_zigzag_gbdt_v3",
  "name": "XT.COM 5m ZigZag GBDT v3 (1-POS High-WR 1.5R Champion)",
  "version": 3,
  "exchange": "xt",
  "timeframe": "5m",
  "datasetId": "xt_5m_62d_191c_plus_775c_oos",
  "createdAt": "2026-11-21T17:13:48.996Z",
  "isDefault": true,
  "zigzagParams": {
    "atrPeriod": 17,
    "minCandles": 9,
    "atrMultiplier": 1,
    "minCandlesForLongLeg": 12,
    "longLegAtrMultiplier": 15,
    "minCandlesForBlueLeg": 7,
    "blueLegAtrMultiplier": 4.75,
    "maxBlueLegPercent": 95,
    "maxBreakoutAtrMultiplier": 4
  },
  "slAtrMult": 4.5,
  "minSlPct": 3,
  "tpAtrMult": 6.75,
  "targetRR": 1.5,
  "timeStopCandles": 144,
  "minAtrPct": 0.25,
  "minStretchPct": 1.5,
  "baseScore": 0.26252,
  "learningRate": 0.05,
  "maxDepth": 2,
  "l2Lambda": 240,
  "objective": "blended",
  "sideFilter": "BOTH",
  "scoreThreshold": 0.35154,
  "topPercent": 8,
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
    "rsi_cool"
  ],
  "trees": [
    {
      "isLeaf": false,
      "v": 0,
      "f": 30,
      "th": -0.0122,
      "l": {
        "isLeaf": false,
        "v": 0.03028,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.03431
        },
        "r": {
          "isLeaf": true,
          "v": 0.05455
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05482,
        "f": 40,
        "th": 0.8603,
        "l": {
          "isLeaf": true,
          "v": -0.06686
        },
        "r": {
          "isLeaf": true,
          "v": 0.00709
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00039,
      "f": 30,
      "th": -0.0122,
      "l": {
        "isLeaf": false,
        "v": 0.02902,
        "f": 34,
        "th": 0,
        "l": {
          "isLeaf": true,
          "v": 0.06152
        },
        "r": {
          "isLeaf": true,
          "v": -0.01204
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05347,
        "f": 40,
        "th": 0.8603,
        "l": {
          "isLeaf": true,
          "v": -0.06529
        },
        "r": {
          "isLeaf": true,
          "v": 0.00702
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00046,
      "f": 30,
      "th": -0.0122,
      "l": {
        "isLeaf": false,
        "v": 0.02821,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.03398
        },
        "r": {
          "isLeaf": true,
          "v": 0.05188
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.05216,
        "f": 7,
        "th": 2,
        "l": {
          "isLeaf": true,
          "v": 0.00478
        },
        "r": {
          "isLeaf": true,
          "v": -0.05789
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00079,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.06201,
        "f": 42,
        "th": 10.1621,
        "l": {
          "isLeaf": true,
          "v": -0.0676
        },
        "r": {
          "isLeaf": true,
          "v": 0.00673
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03319,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.02096
        },
        "r": {
          "isLeaf": true,
          "v": 0.051
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00105,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.06033,
        "f": 21,
        "th": 3.7814,
        "l": {
          "isLeaf": true,
          "v": -0.066
        },
        "r": {
          "isLeaf": true,
          "v": 0.00549
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03192,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.06463
        },
        "r": {
          "isLeaf": true,
          "v": -0.01758
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00114,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05873,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": -0.0055
        },
        "r": {
          "isLeaf": true,
          "v": -0.0758
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03093,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.06267
        },
        "r": {
          "isLeaf": true,
          "v": -0.01708
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00143,
      "f": 30,
      "th": -0.0122,
      "l": {
        "isLeaf": false,
        "v": 0.02479,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.03316
        },
        "r": {
          "isLeaf": true,
          "v": 0.04731
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.04825,
        "f": 7,
        "th": 2,
        "l": {
          "isLeaf": true,
          "v": 0.00539
        },
        "r": {
          "isLeaf": true,
          "v": -0.05409
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00171,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05695,
        "f": 42,
        "th": 10.1621,
        "l": {
          "isLeaf": true,
          "v": -0.06258
        },
        "r": {
          "isLeaf": true,
          "v": 0.00715
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02921,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.06005
        },
        "r": {
          "isLeaf": true,
          "v": -0.01708
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00175,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.03354,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.06067
        },
        "r": {
          "isLeaf": true,
          "v": -0.02919
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03441,
        "f": 17,
        "th": 0.5372,
        "l": {
          "isLeaf": true,
          "v": 0.01953
        },
        "r": {
          "isLeaf": true,
          "v": -0.04667
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00162,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05522,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": -0.00392
        },
        "r": {
          "isLeaf": true,
          "v": -0.07256
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02837,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.05819
        },
        "r": {
          "isLeaf": true,
          "v": -0.01645
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00188,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.03212,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.05852
        },
        "r": {
          "isLeaf": true,
          "v": -0.0286
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03329,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.05469
        },
        "r": {
          "isLeaf": true,
          "v": 0.01392
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00189,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05419,
        "f": 42,
        "th": 10.1621,
        "l": {
          "isLeaf": true,
          "v": -0.05977
        },
        "r": {
          "isLeaf": true,
          "v": 0.00723
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02744,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.05632
        },
        "r": {
          "isLeaf": true,
          "v": -0.01594
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00192,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05271,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": -0.00303
        },
        "r": {
          "isLeaf": true,
          "v": -0.07001
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02659,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.05461
        },
        "r": {
          "isLeaf": true,
          "v": -0.01548
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00216,
      "f": 32,
      "th": 4.4705,
      "l": {
        "isLeaf": false,
        "v": -0.03606,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00496
        },
        "r": {
          "isLeaf": true,
          "v": -0.06478
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.039,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01504
        },
        "r": {
          "isLeaf": true,
          "v": 0.05755
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00223,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.0306,
        "f": 40,
        "th": 0.7455,
        "l": {
          "isLeaf": true,
          "v": -0.02478
        },
        "r": {
          "isLeaf": true,
          "v": 0.05612
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03241,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.05302
        },
        "r": {
          "isLeaf": true,
          "v": 0.01325
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0022,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.0296,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.05517
        },
        "r": {
          "isLeaf": true,
          "v": -0.02823
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03143,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.0515
        },
        "r": {
          "isLeaf": true,
          "v": 0.01296
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00221,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.05054,
        "f": 21,
        "th": 3.7814,
        "l": {
          "isLeaf": true,
          "v": -0.05649
        },
        "r": {
          "isLeaf": true,
          "v": 0.00688
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02502,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.05216
        },
        "r": {
          "isLeaf": true,
          "v": -0.01541
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00222,
      "f": 32,
      "th": 4.4705,
      "l": {
        "isLeaf": false,
        "v": -0.03431,
        "f": 32,
        "th": 1.3102,
        "l": {
          "isLeaf": true,
          "v": -0.04917
        },
        "r": {
          "isLeaf": true,
          "v": -0.0033
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.0368,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.01883
        },
        "r": {
          "isLeaf": true,
          "v": 0.05659
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00226,
      "f": 32,
      "th": 4.4705,
      "l": {
        "isLeaf": false,
        "v": -0.03339,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.0057
        },
        "r": {
          "isLeaf": true,
          "v": -0.06124
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03564,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.01853
        },
        "r": {
          "isLeaf": true,
          "v": 0.055
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00234,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.04716,
        "f": 42,
        "th": 10.1621,
        "l": {
          "isLeaf": true,
          "v": -0.05281
        },
        "r": {
          "isLeaf": true,
          "v": 0.00782
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02299,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.04919
        },
        "r": {
          "isLeaf": true,
          "v": -0.01555
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00233,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02943,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00531
        },
        "r": {
          "isLeaf": true,
          "v": -0.05598
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03758,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01682
        },
        "r": {
          "isLeaf": true,
          "v": 0.05679
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00232,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.04522,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": -0.00034
        },
        "r": {
          "isLeaf": true,
          "v": -0.0624
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02194,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.04731
        },
        "r": {
          "isLeaf": true,
          "v": -0.01524
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00251,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02852,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00482
        },
        "r": {
          "isLeaf": true,
          "v": -0.05387
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03592,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01683
        },
        "r": {
          "isLeaf": true,
          "v": 0.0548
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0025,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02797,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.0522
        },
        "r": {
          "isLeaf": true,
          "v": -0.02677
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.03038,
        "f": 17,
        "th": 0.5372,
        "l": {
          "isLeaf": true,
          "v": 0.01871
        },
        "r": {
          "isLeaf": true,
          "v": -0.04187
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00235,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.04363,
        "f": 42,
        "th": 10.1621,
        "l": {
          "isLeaf": true,
          "v": -0.04926
        },
        "r": {
          "isLeaf": true,
          "v": 0.00803
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02103,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.0455
        },
        "r": {
          "isLeaf": true,
          "v": -0.01478
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00234,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02723,
        "f": 32,
        "th": 1.3102,
        "l": {
          "isLeaf": true,
          "v": -0.04241
        },
        "r": {
          "isLeaf": true,
          "v": -0.00245
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03441,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01673
        },
        "r": {
          "isLeaf": true,
          "v": 0.05291
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00231,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.0265,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00525
        },
        "r": {
          "isLeaf": true,
          "v": -0.05095
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03342,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.01434
        },
        "r": {
          "isLeaf": true,
          "v": 0.04972
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00229,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02693,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.05038
        },
        "r": {
          "isLeaf": true,
          "v": -0.02597
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02907,
        "f": 17,
        "th": 0.5372,
        "l": {
          "isLeaf": true,
          "v": 0.01822
        },
        "r": {
          "isLeaf": true,
          "v": -0.0402
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00215,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.04053,
        "f": 21,
        "th": 3.7814,
        "l": {
          "isLeaf": true,
          "v": -0.04688
        },
        "r": {
          "isLeaf": true,
          "v": 0.00847
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01957,
        "f": 19,
        "th": 0.1979,
        "l": {
          "isLeaf": true,
          "v": -0.01957
        },
        "r": {
          "isLeaf": true,
          "v": 0.03858
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00224,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02545,
        "f": 44,
        "th": 0.0066,
        "l": {
          "isLeaf": true,
          "v": 0.00944
        },
        "r": {
          "isLeaf": true,
          "v": -0.03441
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.03205,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01704
        },
        "r": {
          "isLeaf": true,
          "v": 0.05028
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00205,
      "f": 30,
      "th": -0.0122,
      "l": {
        "isLeaf": false,
        "v": 0.01585,
        "f": 7,
        "th": 3,
        "l": {
          "isLeaf": true,
          "v": -0.03335
        },
        "r": {
          "isLeaf": true,
          "v": 0.0366
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.0335,
        "f": 40,
        "th": 0.8603,
        "l": {
          "isLeaf": true,
          "v": -0.0454
        },
        "r": {
          "isLeaf": true,
          "v": 0.01119
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00225,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.0259,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04888
        },
        "r": {
          "isLeaf": true,
          "v": -0.02562
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02803,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.0473
        },
        "r": {
          "isLeaf": true,
          "v": 0.01338
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00225,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02445,
        "f": 44,
        "th": 0.0066,
        "l": {
          "isLeaf": true,
          "v": 0.00948
        },
        "r": {
          "isLeaf": true,
          "v": -0.03327
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.0306,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01686
        },
        "r": {
          "isLeaf": true,
          "v": 0.04842
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00206,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03735,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00309
        },
        "r": {
          "isLeaf": true,
          "v": -0.05502
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01794,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.04138
        },
        "r": {
          "isLeaf": true,
          "v": -0.01541
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00221,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02495,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04732
        },
        "r": {
          "isLeaf": true,
          "v": -0.02504
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02707,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.04585
        },
        "r": {
          "isLeaf": true,
          "v": 0.01315
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0022,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02342,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00573
        },
        "r": {
          "isLeaf": true,
          "v": -0.0463
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02919,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01676
        },
        "r": {
          "isLeaf": true,
          "v": 0.04666
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0022,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03613,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00276
        },
        "r": {
          "isLeaf": true,
          "v": -0.05299
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01708,
        "f": 12,
        "th": 0.4056,
        "l": {
          "isLeaf": true,
          "v": -0.01805
        },
        "r": {
          "isLeaf": true,
          "v": 0.03899
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00238,
      "f": 12,
      "th": 0.4056,
      "l": {
        "isLeaf": false,
        "v": -0.02939,
        "f": 18,
        "th": 1.02,
        "l": {
          "isLeaf": true,
          "v": -0.03898
        },
        "r": {
          "isLeaf": true,
          "v": 0.01314
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01692,
        "f": 30,
        "th": -0.1184,
        "l": {
          "isLeaf": true,
          "v": 0.03766
        },
        "r": {
          "isLeaf": true,
          "v": -0.01497
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00229,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02262,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00558
        },
        "r": {
          "isLeaf": true,
          "v": -0.04477
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02786,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01684
        },
        "r": {
          "isLeaf": true,
          "v": 0.04512
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00229,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.024,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04563
        },
        "r": {
          "isLeaf": true,
          "v": -0.02425
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02631,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.04432
        },
        "r": {
          "isLeaf": true,
          "v": 0.01247
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00228,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02317,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04431
        },
        "r": {
          "isLeaf": true,
          "v": -0.02381
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.0255,
        "f": 17,
        "th": 0.5372,
        "l": {
          "isLeaf": true,
          "v": 0.01854
        },
        "r": {
          "isLeaf": true,
          "v": -0.03644
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00214,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02236,
        "f": 40,
        "th": 0.7455,
        "l": {
          "isLeaf": true,
          "v": -0.02283
        },
        "r": {
          "isLeaf": true,
          "v": 0.04432
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02452,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.04221
        },
        "r": {
          "isLeaf": true,
          "v": 0.01282
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00211,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03404,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00295
        },
        "r": {
          "isLeaf": true,
          "v": -0.05029
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01604,
        "f": 12,
        "th": 0.4056,
        "l": {
          "isLeaf": true,
          "v": -0.01764
        },
        "r": {
          "isLeaf": true,
          "v": 0.03718
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00228,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.0217,
        "f": 44,
        "th": 0.0066,
        "l": {
          "isLeaf": true,
          "v": 0.01107
        },
        "r": {
          "isLeaf": true,
          "v": -0.03083
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02656,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01669
        },
        "r": {
          "isLeaf": true,
          "v": 0.04345
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0021,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03283,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00337
        },
        "r": {
          "isLeaf": true,
          "v": -0.04905
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.0154,
        "f": 19,
        "th": 0.1979,
        "l": {
          "isLeaf": true,
          "v": -0.02066
        },
        "r": {
          "isLeaf": true,
          "v": 0.03381
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00232,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02092,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00527
        },
        "r": {
          "isLeaf": true,
          "v": -0.04155
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02538,
        "f": 42,
        "th": 7.7978,
        "l": {
          "isLeaf": true,
          "v": -0.01668
        },
        "r": {
          "isLeaf": true,
          "v": 0.04202
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00231,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02142,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04202
        },
        "r": {
          "isLeaf": true,
          "v": -0.02361
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02391,
        "f": 17,
        "th": 0.5372,
        "l": {
          "isLeaf": true,
          "v": 0.01848
        },
        "r": {
          "isLeaf": true,
          "v": -0.03466
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00217,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03164,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00315
        },
        "r": {
          "isLeaf": true,
          "v": -0.04717
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01464,
        "f": 13,
        "th": 1.4921,
        "l": {
          "isLeaf": true,
          "v": 0.0367
        },
        "r": {
          "isLeaf": true,
          "v": -0.01578
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00229,
      "f": 12,
      "th": 0.4056,
      "l": {
        "isLeaf": false,
        "v": -0.02937,
        "f": 23,
        "th": -4.5612,
        "l": {
          "isLeaf": true,
          "v": 0.01398
        },
        "r": {
          "isLeaf": true,
          "v": -0.03997
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01703,
        "f": 41,
        "th": 5.6462,
        "l": {
          "isLeaf": true,
          "v": -0.02343
        },
        "r": {
          "isLeaf": true,
          "v": 0.0337
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00234,
      "f": 12,
      "th": 0.4056,
      "l": {
        "isLeaf": false,
        "v": -0.02843,
        "f": 23,
        "th": -4.5612,
        "l": {
          "isLeaf": true,
          "v": 0.01385
        },
        "r": {
          "isLeaf": true,
          "v": -0.03887
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01633,
        "f": 41,
        "th": 5.6462,
        "l": {
          "isLeaf": true,
          "v": -0.02298
        },
        "r": {
          "isLeaf": true,
          "v": 0.03259
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00237,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.02051,
        "f": 36,
        "th": 1.8265,
        "l": {
          "isLeaf": true,
          "v": 0.04091
        },
        "r": {
          "isLeaf": true,
          "v": -0.02363
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02315,
        "f": 1,
        "th": 0.6546,
        "l": {
          "isLeaf": true,
          "v": -0.04027
        },
        "r": {
          "isLeaf": true,
          "v": 0.01264
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00236,
      "f": 32,
      "th": 1.3102,
      "l": {
        "isLeaf": false,
        "v": -0.03135,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.003
        },
        "r": {
          "isLeaf": true,
          "v": -0.04661
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01424,
        "f": 12,
        "th": 0.4056,
        "l": {
          "isLeaf": true,
          "v": -0.01661
        },
        "r": {
          "isLeaf": true,
          "v": 0.03377
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0025,
      "f": 32,
      "th": 5.2186,
      "l": {
        "isLeaf": false,
        "v": -0.02007,
        "f": 27,
        "th": 1.297,
        "l": {
          "isLeaf": true,
          "v": 0.00463
        },
        "r": {
          "isLeaf": true,
          "v": -0.03935
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.02377,
        "f": 18,
        "th": 0.8244,
        "l": {
          "isLeaf": true,
          "v": -0.01275
        },
        "r": {
          "isLeaf": true,
          "v": 0.04545
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.0024,
      "f": 34,
      "th": 0,
      "l": {
        "isLeaf": false,
        "v": 0.01975,
        "f": 40,
        "th": 0.7455,
        "l": {
          "isLeaf": true,
          "v": -0.02232
        },
        "r": {
          "isLeaf": true,
          "v": 0.04065
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.02247,
        "f": 23,
        "th": -0.4695,
        "l": {
          "isLeaf": true,
          "v": 0.00972
        },
        "r": {
          "isLeaf": true,
          "v": -0.03973
        }
      }
    },
    {
      "isLeaf": false,
      "v": -0.00239,
      "f": 12,
      "th": 0.4056,
      "l": {
        "isLeaf": false,
        "v": -0.02759,
        "f": 23,
        "th": -4.5612,
        "l": {
          "isLeaf": true,
          "v": 0.01377
        },
        "r": {
          "isLeaf": true,
          "v": -0.0379
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0.01566,
        "f": 8,
        "th": 4.9909,
        "l": {
          "isLeaf": true,
          "v": 0.0445
        },
        "r": {
          "isLeaf": true,
          "v": -0.00869
        }
      }
    }
  ],
  "featureImportance": [
    {
      "name": "ret24h_stretch",
      "gain": 48.11,
      "weightPct": 30.27
    },
    {
      "name": "isLong",
      "gain": 16.41,
      "weightPct": 10.33
    },
    {
      "name": "imp_vs_corr",
      "gain": 15.2,
      "weightPct": 9.56
    },
    {
      "name": "ret1h_stretch",
      "gain": 12.89,
      "weightPct": 8.11
    },
    {
      "name": "whiteStreak",
      "gain": 10.7,
      "weightPct": 6.73
    },
    {
      "name": "ema50_ext_pct",
      "gain": 10.11,
      "weightPct": 6.36
    },
    {
      "name": "ema600_slope_dir",
      "gain": 10.06,
      "weightPct": 6.33
    },
    {
      "name": "dollar_vol_log",
      "gain": 8.61,
      "weightPct": 5.42
    },
    {
      "name": "confirmDistAtr",
      "gain": 5.93,
      "weightPct": 3.73
    },
    {
      "name": "r13",
      "gain": 5.25,
      "weightPct": 3.3
    },
    {
      "name": "range_pos_24h",
      "gain": 4.47,
      "weightPct": 2.81
    },
    {
      "name": "vol_1v2",
      "gain": 2.9,
      "weightPct": 1.82
    },
    {
      "name": "brk_depth_p3",
      "gain": 1.68,
      "weightPct": 1.06
    },
    {
      "name": "volTot_1v3",
      "gain": 1.66,
      "weightPct": 1.04
    },
    {
      "name": "range_width_24h_pct",
      "gain": 1.49,
      "weightPct": 0.94
    },
    {
      "name": "rebound_ratio",
      "gain": 1.01,
      "weightPct": 0.64
    },
    {
      "name": "vol_1v3",
      "gain": 0.97,
      "weightPct": 0.61
    },
    {
      "name": "vol_p1_climax",
      "gain": 0.8,
      "weightPct": 0.5
    },
    {
      "name": "l1_atr",
      "gain": 0.69,
      "weightPct": 0.44
    },
    {
      "name": "atrPct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "confirmBody",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l1_type",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l2_type",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "giantCnt4",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "blueCnt4",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l1_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l1_speed",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "r12",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "harm_XD",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "harm_XB",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "harm_BestErr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "volGr_1",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "p1_brk_p3",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_conf",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_p1",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_div",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema200_ext_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema600_ext_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ret4h_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "atr_expansion",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ret15m_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "wick_for",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "wick_against",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "confirm_vol_ratio",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "bb_z_signed",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_cool",
      "gain": 0,
      "weightPct": 0
    }
  ],
  "metrics": {
    "totalSymbols": 775,
    "totalEvents": 34068,
    "train": {
      "totalSignals": 165,
      "winRate": 69.7,
      "avgR": 0.4618,
      "sumR": 76.2,
      "profitFactor": 2.6,
      "longCount": 8,
      "longAvgR": 0.5153,
      "shortCount": 157,
      "shortAvgR": 0.4591,
      "portfolioTrades": 42,
      "portfolioWinRate": 73.81,
      "portfolioSumR": 13.97,
      "portfolioProfitFactor": 2.21,
      "portfolioMaxDdR": 2.1
    },
    "validation": {
      "totalSignals": 91,
      "winRate": 67.03,
      "avgR": 0.4071,
      "sumR": 37.04,
      "profitFactor": 2.49,
      "longCount": 4,
      "longAvgR": 0.0539,
      "shortCount": 87,
      "shortAvgR": 0.4233,
      "portfolioTrades": 17,
      "portfolioWinRate": 52.94,
      "portfolioSumR": 3.14,
      "portfolioProfitFactor": 1.52,
      "portfolioMaxDdR": 2.5
    },
    "oos": {
      "totalSignals": 1076,
      "winRate": 57.25,
      "avgR": 0.1887,
      "sumR": 203.05,
      "profitFactor": 1.52,
      "longCount": 46,
      "longAvgR": -0.1803,
      "shortCount": 1030,
      "shortAvgR": 0.2052,
      "portfolioTrades": 71,
      "portfolioWinRate": 67.61,
      "portfolioSumR": 30.19,
      "portfolioProfitFactor": 2.5,
      "portfolioMaxDdR": 3.46
    },
    "unseenSymbolsOos": {
      "totalSignals": 763,
      "winRate": 56.62,
      "avgR": 0.1757,
      "sumR": 134.03,
      "profitFactor": 1.49,
      "longCount": 5,
      "longAvgR": 0.5368,
      "shortCount": 758,
      "shortAvgR": 0.1733,
      "portfolioTrades": 72,
      "portfolioWinRate": 54.17,
      "portfolioSumR": 9.6,
      "portfolioProfitFactor": 1.31,
      "portfolioMaxDdR": 7.62
    }
  },
  "discoveredPatterns": [
    {
      "name": "تخلیه حجم و کشیدگی شدید ۲۴ ساعته (بازگشت موج فرسوده)",
      "rule": "ret24h_stretch ≥ 5% & Vol(L1)/Vol(L3) < 0.90 & ML Score",
      "category": "volume",
      "trainCount": 77,
      "trainWinRate": 64.9,
      "trainAvgR": 0.367,
      "trainPf": 2.02,
      "oosCount": 364,
      "oosWinRate": 55.2,
      "oosAvgR": 0.157,
      "oosPf": 1.4
    },
    {
      "name": "موج آخر کوچک‌تر از موج‌های قبل (L1 < L2/L3) + ساختار هارمونیک",
      "rule": "r12 < 1.0 & r13 < 1.0 & ML Score ≥ Threshold",
      "category": "harmonic",
      "trainCount": 106,
      "trainWinRate": 70.8,
      "trainAvgR": 0.449,
      "trainPf": 2.57,
      "oosCount": 593,
      "oosWinRate": 57.7,
      "oosAvgR": 0.211,
      "oosPf": 1.59
    },
    {
      "name": "شکست کم‌عمق نقدینگی پیوت P3 (اسویپ کاذب + برگشت سریع)",
      "rule": "P1 Sweep P3 & brk_depth_p3 ≤ 2.5 ATR & ML Score",
      "category": "structure",
      "trainCount": 42,
      "trainWinRate": 64.3,
      "trainAvgR": 0.382,
      "trainPf": 2.08,
      "oosCount": 309,
      "oosWinRate": 56.3,
      "oosAvgR": 0.171,
      "oosPf": 1.46
    },
    {
      "name": "کشیدگی شدید EMA600 در سقف/کف ۲۴ ساعته",
      "rule": "EMA600 Ext ≥ 5% & RangePos24h ≥ 0.65 & ML Score",
      "category": "structure",
      "trainCount": 74,
      "trainWinRate": 70.3,
      "trainAvgR": 0.482,
      "trainPf": 2.61,
      "oosCount": 389,
      "oosWinRate": 52.2,
      "oosAvgR": 0.137,
      "oosPf": 1.31
    },
    {
      "name": "بازگشت لگ غول‌پیکر (سبز/قرمز) یا آبی (CD/EF) با استاپ ۳٪",
      "rule": "L1 = Giant or Blue (CD/EF) & Anti-Sweep SL 3%",
      "category": "legs",
      "trainCount": 0,
      "trainWinRate": 0,
      "trainAvgR": 0,
      "trainPf": 0,
      "oosCount": 5,
      "oosWinRate": 80,
      "oosAvgR": 0.603,
      "oosPf": 3.86
    },
    {
      "name": "توالی لگ‌های سفید (۳+) با واگرایی RSI در پیوت کشیده",
      "rule": "White Streak ≥ 3 & RSI Divergence & ML Score",
      "category": "structure",
      "trainCount": 121,
      "trainWinRate": 68.6,
      "trainAvgR": 0.422,
      "trainPf": 2.43,
      "oosCount": 671,
      "oosWinRate": 56.6,
      "oosAvgR": 0.187,
      "oosPf": 1.49
    }
  ]
};

registerDefaultMlModelFactory(() => PRETRAINED_XT_5M_ML_MODEL);
