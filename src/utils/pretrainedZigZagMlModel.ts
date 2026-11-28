import { registerDefaultMlModelFactory, type ZigZagMlModel } from './zigzagMlEngine';

// Verified v7 Microstructure Regime-Gated Dual-Side Champion Model (Structural 3.5 ATR ZigZag + 59 Causal Features + Breakeven Protect):
// - Trained on 172 diverse pure-crypto XT.COM USDT perpetuals over 90 days (4.47M real 5m candles; TradFi/Stocks excluded)
// - New causal feature f[58] (dist_to_24h_extreme_atr) + Short Blow-Off Exhaustion Gate + Long Golden-Cross Pullback Gate + BE Trigger 0.75R -> Lock +0.2R
// - Verified EXACT runStrategy4MlBacktest (1% compounding on $10,000, XT 0.06%+0.06% fees + 0.04% SL slippage, strict eTime > lastExitTime):
//   * Full 90D 1-POS: 199tr (L:23 WR 78.3% PF 5.08 | S:176 WR 64.8% PF 1.61) WR 66.3% / PF 1.75 / $5131.83 / DD 5.2%
//   * Untouched OOS 1-POS: 48tr WR 64.6% / PF 1.66 / $948 / DD 3.6%
//   * Unseen Coins 90D 1-POS: 88tr WR 52.3% / PF 0.96 / $-126.43 / DD 5.9%
//   * Full 90D Multi-POS: 599tr WR 63.1% / PF 1.45 / $11858.37
export const PRETRAINED_XT_5M_ML_MODEL: ZigZagMlModel = {
  "id": "pretrained_xt_5m_zigzag_gbdt_v7",
  "name": "XT.COM 5m ZigZag GBDT v7 (دوجهته لانگ+شورت)",
  "version": 7,
  "exchange": "xt",
  "timeframe": "5m",
  "datasetId": "xt_5m_pure_crypto_90d_172c",
  "createdAt": "2026-11-28T00:18:08.945Z",
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
  "slAtrMult": 5.5,
  "minSlPct": 3.5,
  "tpAtrMult": 7.97,
  "targetRR": 1.45,
  "beTriggerR": 0.75,
  "beLockR": 0.2,
  "timeStopCandles": 150,
  "minAtrPct": 0.3,
  "minStretchPct": 0,
  "baseScore": 0,
  "learningRate": 0.025,
  "maxDepth": 2,
  "l2Lambda": 1000,
  "objective": "blended",
  "sideFilter": "BOTH",
  "scoreThreshold": 0.22763,
  "topPercent": 6,
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
    "dist_from_ema50_signed_atr",
    "dist_to_24h_extreme_atr"
  ],
  "trees": [
    {
      "isLeaf": false,
      "v": 0,
      "f": 41,
      "th": 5,
      "l": {
        "isLeaf": true,
        "v": -800
      },
      "r": {
        "isLeaf": false,
        "v": 0,
        "f": 34,
        "th": 0.5,
        "l": {
          "isLeaf": false,
          "v": 0,
          "f": 57,
          "th": -3.2,
          "l": {
            "isLeaf": false,
            "v": 0,
            "f": 44,
            "th": 0.25,
            "l": {
              "isLeaf": false,
              "v": 0,
              "f": 58,
              "th": 1,
              "l": {
                "isLeaf": true,
                "v": 9.31125
              },
              "r": {
                "isLeaf": true,
                "v": -800
              }
            },
            "r": {
              "isLeaf": true,
              "v": -800
            }
          },
          "r": {
            "isLeaf": true,
            "v": -800
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0,
          "f": 54,
          "th": 0.5,
          "l": {
            "isLeaf": true,
            "v": -800
          },
          "r": {
            "isLeaf": false,
            "v": 0,
            "f": 27,
            "th": 1,
            "l": {
              "isLeaf": true,
              "v": -800
            },
            "r": {
              "isLeaf": false,
              "v": 0,
              "f": 50,
              "th": -0.000001,
              "l": {
                "isLeaf": false,
                "v": 0,
                "f": 58,
                "th": 2,
                "l": {
                  "isLeaf": true,
                  "v": 9.2209
                },
                "r": {
                  "isLeaf": true,
                  "v": -800
                }
              },
              "r": {
                "isLeaf": true,
                "v": -800
              }
            }
          }
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01249,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01747
          },
          "r": {
            "isLeaf": true,
            "v": 0.00499
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01308,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01993
          },
          "r": {
            "isLeaf": true,
            "v": -0.00671
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00649
        },
        "r": {
          "isLeaf": true,
          "v": -0.00661
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00001,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01136,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.0167
          },
          "r": {
            "isLeaf": true,
            "v": -0.00485
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01172,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.01472
          },
          "r": {
            "isLeaf": true,
            "v": 0.00292
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00648
        },
        "r": {
          "isLeaf": true,
          "v": -0.00661
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00002,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01243,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.0045
          },
          "r": {
            "isLeaf": true,
            "v": -0.01694
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01305,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00635
          },
          "r": {
            "isLeaf": true,
            "v": 0.0197
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00001,
        "f": 9,
        "th": 8.6814,
        "l": {
          "isLeaf": true,
          "v": 0.0055
        },
        "r": {
          "isLeaf": true,
          "v": -0.00544
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00003,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01239,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.0045
          },
          "r": {
            "isLeaf": true,
            "v": -0.01689
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01302,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00634
          },
          "r": {
            "isLeaf": true,
            "v": 0.01966
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": 0,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00648
        },
        "r": {
          "isLeaf": true,
          "v": -0.0066
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00005,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01132,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01663
          },
          "r": {
            "isLeaf": true,
            "v": -0.00483
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01164,
          "f": 51,
          "th": 7.91365,
          "l": {
            "isLeaf": true,
            "v": -0.01462
          },
          "r": {
            "isLeaf": true,
            "v": 0.00248
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00001,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00647
        },
        "r": {
          "isLeaf": true,
          "v": -0.0066
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00004,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01234,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.00449
          },
          "r": {
            "isLeaf": true,
            "v": -0.01683
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01298,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.0198
          },
          "r": {
            "isLeaf": true,
            "v": -0.00668
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00001,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00647
        },
        "r": {
          "isLeaf": true,
          "v": -0.0066
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00006,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.0123,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01729
          },
          "r": {
            "isLeaf": true,
            "v": 0.00501
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01295,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00633
          },
          "r": {
            "isLeaf": true,
            "v": 0.01958
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00001,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00646
        },
        "r": {
          "isLeaf": true,
          "v": -0.0066
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00007,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01225,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01724
          },
          "r": {
            "isLeaf": true,
            "v": 0.005
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01292,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01973
          },
          "r": {
            "isLeaf": true,
            "v": -0.00667
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00002,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00619
        },
        "r": {
          "isLeaf": true,
          "v": -0.00631
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00009,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01221,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01719
          },
          "r": {
            "isLeaf": true,
            "v": 0.005
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01289,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01969
          },
          "r": {
            "isLeaf": true,
            "v": -0.00667
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00002,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00645
        },
        "r": {
          "isLeaf": true,
          "v": -0.00659
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.0001,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01129,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01655
          },
          "r": {
            "isLeaf": true,
            "v": -0.00478
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01155,
          "f": 51,
          "th": 7.91365,
          "l": {
            "isLeaf": true,
            "v": -0.01454
          },
          "r": {
            "isLeaf": true,
            "v": 0.0025
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00002,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00645
        },
        "r": {
          "isLeaf": true,
          "v": -0.00659
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00009,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01216,
          "f": 51,
          "th": 5.14396,
          "l": {
            "isLeaf": true,
            "v": 0.00198
          },
          "r": {
            "isLeaf": true,
            "v": -0.01425
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01285,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00631
          },
          "r": {
            "isLeaf": true,
            "v": 0.01946
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00002,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00618
        },
        "r": {
          "isLeaf": true,
          "v": -0.00631
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00011,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01212,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.0171
          },
          "r": {
            "isLeaf": true,
            "v": 0.005
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01282,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01961
          },
          "r": {
            "isLeaf": true,
            "v": -0.00665
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00644
        },
        "r": {
          "isLeaf": true,
          "v": -0.00659
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00012,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01207,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01705
          },
          "r": {
            "isLeaf": true,
            "v": 0.005
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01279,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01957
          },
          "r": {
            "isLeaf": true,
            "v": -0.00664
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00618
        },
        "r": {
          "isLeaf": true,
          "v": -0.0063
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00014,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01203,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.017
          },
          "r": {
            "isLeaf": true,
            "v": 0.005
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01276,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.0063
          },
          "r": {
            "isLeaf": true,
            "v": 0.01936
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00617
        },
        "r": {
          "isLeaf": true,
          "v": -0.0063
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00015,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01198,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01695
          },
          "r": {
            "isLeaf": true,
            "v": 0.00499
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01273,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.0063
          },
          "r": {
            "isLeaf": true,
            "v": 0.01932
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 9,
        "th": 8.6814,
        "l": {
          "isLeaf": true,
          "v": 0.00548
        },
        "r": {
          "isLeaf": true,
          "v": -0.00544
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00017,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01194,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.0169
          },
          "r": {
            "isLeaf": true,
            "v": 0.00499
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.0127,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00629
          },
          "r": {
            "isLeaf": true,
            "v": 0.01929
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00643
        },
        "r": {
          "isLeaf": true,
          "v": -0.00658
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00019,
        "f": 32,
        "th": 8.4666,
        "l": {
          "isLeaf": false,
          "v": -0.00883,
          "f": 51,
          "th": 8.27771,
          "l": {
            "isLeaf": true,
            "v": -0.01441
          },
          "r": {
            "isLeaf": true,
            "v": 0.00602
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00975,
          "f": 28,
          "th": 5.97204,
          "l": {
            "isLeaf": true,
            "v": -0.00188
          },
          "r": {
            "isLeaf": true,
            "v": 0.01179
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00003,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00616
        },
        "r": {
          "isLeaf": true,
          "v": -0.0063
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00021,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01128,
          "f": 28,
          "th": 2.83678,
          "l": {
            "isLeaf": true,
            "v": -0.00475
          },
          "r": {
            "isLeaf": true,
            "v": 0.01592
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01142,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.01442
          },
          "r": {
            "isLeaf": true,
            "v": 0.00293
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00004,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00616
        },
        "r": {
          "isLeaf": true,
          "v": -0.00629
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.0002,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01124,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01644
          },
          "r": {
            "isLeaf": true,
            "v": -0.00472
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01139,
          "f": 51,
          "th": 7.91365,
          "l": {
            "isLeaf": true,
            "v": -0.01441
          },
          "r": {
            "isLeaf": true,
            "v": 0.00254
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00004,
        "f": 57,
        "th": -4.4096,
        "l": {
          "isLeaf": true,
          "v": 0.00615
        },
        "r": {
          "isLeaf": true,
          "v": -0.00629
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00019,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01187,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01683
          },
          "r": {
            "isLeaf": true,
            "v": 0.00498
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01266,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01941
          },
          "r": {
            "isLeaf": true,
            "v": -0.00662
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00004,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00642
        },
        "r": {
          "isLeaf": true,
          "v": -0.00658
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00021,
        "f": 32,
        "th": 8.4666,
        "l": {
          "isLeaf": false,
          "v": -0.00879,
          "f": 25,
          "th": 87.3805,
          "l": {
            "isLeaf": true,
            "v": -0.01261
          },
          "r": {
            "isLeaf": true,
            "v": 0.00418
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00973,
          "f": 0,
          "th": 0.58468,
          "l": {
            "isLeaf": true,
            "v": -0.00291
          },
          "r": {
            "isLeaf": true,
            "v": 0.01269
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00004,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00642
        },
        "r": {
          "isLeaf": true,
          "v": -0.00658
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00023,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01123,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01641
          },
          "r": {
            "isLeaf": true,
            "v": -0.0047
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01134,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.01435
          },
          "r": {
            "isLeaf": true,
            "v": 0.00293
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00005,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00641
        },
        "r": {
          "isLeaf": true,
          "v": -0.00658
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00023,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01181,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01675
          },
          "r": {
            "isLeaf": true,
            "v": 0.00498
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01263,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01937
          },
          "r": {
            "isLeaf": true,
            "v": -0.0066
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00005,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.0064
        },
        "r": {
          "isLeaf": true,
          "v": -0.00658
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00024,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.0112,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01636
          },
          "r": {
            "isLeaf": true,
            "v": -0.00468
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.0113,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.0143
          },
          "r": {
            "isLeaf": true,
            "v": 0.00293
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00005,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.0064
        },
        "r": {
          "isLeaf": true,
          "v": -0.00657
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00024,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01175,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.00456
          },
          "r": {
            "isLeaf": true,
            "v": -0.0163
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01259,
          "f": 51,
          "th": 7.0184,
          "l": {
            "isLeaf": true,
            "v": -0.00215
          },
          "r": {
            "isLeaf": true,
            "v": 0.01554
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00006,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00639
        },
        "r": {
          "isLeaf": true,
          "v": -0.00657
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00027,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01171,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01666
          },
          "r": {
            "isLeaf": true,
            "v": 0.00498
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01258,
          "f": 54,
          "th": -0.47047,
          "l": {
            "isLeaf": true,
            "v": 0.01514
          },
          "r": {
            "isLeaf": true,
            "v": -0.00241
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00006,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00639
        },
        "r": {
          "isLeaf": true,
          "v": -0.00657
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00028,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01167,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01661
          },
          "r": {
            "isLeaf": true,
            "v": 0.00497
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01255,
          "f": 51,
          "th": 7.0184,
          "l": {
            "isLeaf": true,
            "v": -0.00216
          },
          "r": {
            "isLeaf": true,
            "v": 0.01551
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00006,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00638
        },
        "r": {
          "isLeaf": true,
          "v": -0.00656
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00031,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01119,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01633
          },
          "r": {
            "isLeaf": true,
            "v": -0.00466
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01121,
          "f": 51,
          "th": 7.91365,
          "l": {
            "isLeaf": true,
            "v": -0.01427
          },
          "r": {
            "isLeaf": true,
            "v": 0.00258
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00006,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00638
        },
        "r": {
          "isLeaf": true,
          "v": -0.00656
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.0003,
        "f": 27,
        "th": 3.25406,
        "l": {
          "isLeaf": false,
          "v": -0.00856,
          "f": 51,
          "th": 4.7991,
          "l": {
            "isLeaf": true,
            "v": 0.00327
          },
          "r": {
            "isLeaf": true,
            "v": -0.01176
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.00892,
          "f": 54,
          "th": -0.71593,
          "l": {
            "isLeaf": true,
            "v": 0.01372
          },
          "r": {
            "isLeaf": true,
            "v": -0.00427
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00007,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00637
        },
        "r": {
          "isLeaf": true,
          "v": -0.00656
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00031,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01161,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01655
          },
          "r": {
            "isLeaf": true,
            "v": 0.00497
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01253,
          "f": 54,
          "th": -0.47047,
          "l": {
            "isLeaf": true,
            "v": 0.01509
          },
          "r": {
            "isLeaf": true,
            "v": -0.00241
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00007,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00636
        },
        "r": {
          "isLeaf": true,
          "v": -0.00655
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00033,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01117,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.0163
          },
          "r": {
            "isLeaf": true,
            "v": -0.00466
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01117,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.01416
          },
          "r": {
            "isLeaf": true,
            "v": 0.00293
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00007,
        "f": 43,
        "th": 3.62327,
        "l": {
          "isLeaf": true,
          "v": -0.00541
        },
        "r": {
          "isLeaf": true,
          "v": 0.00545
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00033,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01156,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01649
          },
          "r": {
            "isLeaf": true,
            "v": 0.00496
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01249,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00628
          },
          "r": {
            "isLeaf": true,
            "v": 0.01905
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00007,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00636
        },
        "r": {
          "isLeaf": true,
          "v": -0.00655
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00034,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01152,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01644
          },
          "r": {
            "isLeaf": true,
            "v": 0.00496
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01246,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01919
          },
          "r": {
            "isLeaf": true,
            "v": -0.0066
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00007,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00635
        },
        "r": {
          "isLeaf": true,
          "v": -0.00655
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00035,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01148,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.00459
          },
          "r": {
            "isLeaf": true,
            "v": -0.01604
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01243,
          "f": 1,
          "th": 0.21082,
          "l": {
            "isLeaf": true,
            "v": -0.00627
          },
          "r": {
            "isLeaf": true,
            "v": 0.01898
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00008,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00635
        },
        "r": {
          "isLeaf": true,
          "v": -0.00654
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00037,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01143,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01636
          },
          "r": {
            "isLeaf": true,
            "v": 0.00496
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01241,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01912
          },
          "r": {
            "isLeaf": true,
            "v": -0.00659
          }
        }
      },
      "r": {
        "isLeaf": false,
        "v": -0.00008,
        "f": 50,
        "th": -0.89517,
        "l": {
          "isLeaf": true,
          "v": 0.00634
        },
        "r": {
          "isLeaf": true,
          "v": -0.00654
        }
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00038,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01139,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01631
          },
          "r": {
            "isLeaf": true,
            "v": 0.00496
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01238,
          "f": 51,
          "th": 7.0184,
          "l": {
            "isLeaf": true,
            "v": -0.00224
          },
          "r": {
            "isLeaf": true,
            "v": 0.0154
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00041,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01114,
          "f": 28,
          "th": 2.83678,
          "l": {
            "isLeaf": true,
            "v": -0.00474
          },
          "r": {
            "isLeaf": true,
            "v": 0.01577
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01105,
          "f": 25,
          "th": 87.3805,
          "l": {
            "isLeaf": true,
            "v": -0.01326
          },
          "r": {
            "isLeaf": true,
            "v": 0.00203
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00039,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.0111,
          "f": 28,
          "th": 2.83678,
          "l": {
            "isLeaf": true,
            "v": -0.00474
          },
          "r": {
            "isLeaf": true,
            "v": 0.01572
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01102,
          "f": 24,
          "th": 87.17503,
          "l": {
            "isLeaf": true,
            "v": -0.0132
          },
          "r": {
            "isLeaf": true,
            "v": 0.00199
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00038,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01106,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01618
          },
          "r": {
            "isLeaf": true,
            "v": -0.00464
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01099,
          "f": 51,
          "th": 7.91365,
          "l": {
            "isLeaf": true,
            "v": -0.01409
          },
          "r": {
            "isLeaf": true,
            "v": 0.00264
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00037,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01134,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01625
          },
          "r": {
            "isLeaf": true,
            "v": 0.00495
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01232,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01903
          },
          "r": {
            "isLeaf": true,
            "v": -0.0066
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00039,
        "f": 19,
        "th": 1.76071,
        "l": {
          "isLeaf": false,
          "v": 0.01103,
          "f": 40,
          "th": 0.98734,
          "l": {
            "isLeaf": true,
            "v": 0.01613
          },
          "r": {
            "isLeaf": true,
            "v": -0.00462
          }
        },
        "r": {
          "isLeaf": false,
          "v": -0.01096,
          "f": 10,
          "th": 0.51504,
          "l": {
            "isLeaf": true,
            "v": -0.01396
          },
          "r": {
            "isLeaf": true,
            "v": 0.00294
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00039,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01129,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01619
          },
          "r": {
            "isLeaf": true,
            "v": 0.00494
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01228,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01899
          },
          "r": {
            "isLeaf": true,
            "v": -0.00659
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.0004,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01125,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.00459
          },
          "r": {
            "isLeaf": true,
            "v": -0.01581
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01225,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01895
          },
          "r": {
            "isLeaf": true,
            "v": -0.00658
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00041,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01121,
          "f": 19,
          "th": 0.88961,
          "l": {
            "isLeaf": true,
            "v": 0.00459
          },
          "r": {
            "isLeaf": true,
            "v": -0.01576
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01222,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01891
          },
          "r": {
            "isLeaf": true,
            "v": -0.00658
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    },
    {
      "isLeaf": false,
      "v": 0,
      "f": 34,
      "th": 0.5,
      "l": {
        "isLeaf": false,
        "v": 0.00042,
        "f": 15,
        "th": 1.4717,
        "l": {
          "isLeaf": false,
          "v": -0.01117,
          "f": 10,
          "th": 0.62339,
          "l": {
            "isLeaf": true,
            "v": -0.01607
          },
          "r": {
            "isLeaf": true,
            "v": 0.00495
          }
        },
        "r": {
          "isLeaf": false,
          "v": 0.01219,
          "f": 40,
          "th": 0.9898,
          "l": {
            "isLeaf": true,
            "v": 0.01888
          },
          "r": {
            "isLeaf": true,
            "v": -0.00657
          }
        }
      },
      "r": {
        "isLeaf": true,
        "v": 0
      }
    }
  ],
  "featureImportance": [
    {
      "name": "harm_XB",
      "gain": 9.92,
      "weightPct": 31.51
    },
    {
      "name": "range_pos_24h",
      "gain": 5.83,
      "weightPct": 18.52
    },
    {
      "name": "volTot_1v3",
      "gain": 4.89,
      "weightPct": 15.52
    },
    {
      "name": "l1_speed",
      "gain": 4.33,
      "weightPct": 13.76
    },
    {
      "name": "confirmDistAtr",
      "gain": 2.37,
      "weightPct": 7.52
    },
    {
      "name": "ema50_200_spread_atr",
      "gain": 1.08,
      "weightPct": 3.44
    },
    {
      "name": "p1_to_ema50_atr",
      "gain": 1,
      "weightPct": 3.17
    },
    {
      "name": "ema200_ext_pct",
      "gain": 0.53,
      "weightPct": 1.68
    },
    {
      "name": "ret24h_stretch",
      "gain": 0.39,
      "weightPct": 1.25
    },
    {
      "name": "ema200_slope_dir",
      "gain": 0.29,
      "weightPct": 0.92
    },
    {
      "name": "dist_from_ema50_signed_atr",
      "gain": 0.28,
      "weightPct": 0.89
    },
    {
      "name": "rsi_p1",
      "gain": 0.17,
      "weightPct": 0.54
    },
    {
      "name": "ema50_ext_pct",
      "gain": 0.17,
      "weightPct": 0.56
    },
    {
      "name": "atrPct",
      "gain": 0.08,
      "weightPct": 0.25
    },
    {
      "name": "l1_pct",
      "gain": 0.06,
      "weightPct": 0.2
    },
    {
      "name": "rsi_conf",
      "gain": 0.06,
      "weightPct": 0.19
    },
    {
      "name": "bb_z_signed",
      "gain": 0.03,
      "weightPct": 0.1
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
      "name": "whiteStreak",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "l1_atr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "r12",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "r13",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "imp_vs_corr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "harm_XD",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "harm_BestErr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "vol_1v2",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "vol_1v3",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "volGr_1",
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
      "name": "brk_depth_p3",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_div",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema600_ext_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema600_slope_dir",
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
      "name": "isLong",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ret15m_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ret1h_stretch",
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
      "name": "range_width_24h_pct",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "dollar_vol_log",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rebound_ratio",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "rsi_cool",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema200_ext_atr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "ema600_ext_atr",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "vol_surge_4h_24h",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "active_bar_ratio_48",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "er_48",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "er_288",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "trend_bar_ratio_48",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "pullback_vs_stretch",
      "gain": 0,
      "weightPct": 0
    },
    {
      "name": "dist_to_24h_extreme_atr",
      "gain": 0,
      "weightPct": 0
    }
  ],
  "metrics": {
    "totalSymbols": 172,
    "totalEvents": 75267,
    "train": {
      "totalSignals": 239,
      "winRate": 67.36,
      "avgR": 0.2296,
      "sumR": 54.88,
      "profitFactor": 1.78,
      "longCount": 36,
      "longAvgR": 0.5249,
      "shortCount": 203,
      "shortAvgR": 0.1773,
      "portfolioTrades": 90,
      "portfolioWinRate": 72.22,
      "portfolioSumR": 28.13,
      "portfolioProfitFactor": 2.2,
      "portfolioMaxDdR": 3.32
    },
    "validation": {
      "totalSignals": 126,
      "winRate": 63.49,
      "avgR": 0.0958,
      "sumR": 12.07,
      "profitFactor": 1.29,
      "longCount": 17,
      "longAvgR": -0.0662,
      "shortCount": 109,
      "shortAvgR": 0.1211,
      "portfolioTrades": 52,
      "portfolioWinRate": 67.31,
      "portfolioSumR": 11.19,
      "portfolioProfitFactor": 1.76,
      "portfolioMaxDdR": 6.08
    },
    "oos": {
      "totalSignals": 135,
      "winRate": 60,
      "avgR": 0.1157,
      "sumR": 15.62,
      "profitFactor": 1.36,
      "longCount": 11,
      "longAvgR": -0.1569,
      "shortCount": 124,
      "shortAvgR": 0.1399,
      "portfolioTrades": 45,
      "portfolioWinRate": 62.22,
      "portfolioSumR": 9.12,
      "portfolioProfitFactor": 1.6,
      "portfolioMaxDdR": 4.09
    },
    "unseenSymbolsOos": {
      "totalSignals": 28,
      "winRate": 57.14,
      "avgR": 0.0481,
      "sumR": 1.35,
      "profitFactor": 1.16,
      "longCount": 2,
      "longAvgR": -0.4419,
      "shortCount": 26,
      "shortAvgR": 0.0858,
      "portfolioTrades": 19,
      "portfolioWinRate": 57.89,
      "portfolioSumR": 0.57,
      "portfolioProfitFactor": 1.09,
      "portfolioMaxDdR": 2.49
    }
  },
  "discoveredPatterns": [
    {
      "name": "شورت اوج انفجاری روی سقف ۲۴h (بدون برگشت زودرس)",
      "rule": "EMA50 ≥ +3.2 ATR & Rebound ≤ 0.25 & Dist 24h High ≤ 1.0 ATR",
      "category": "structure",
      "trainCount": 203,
      "trainWinRate": 65,
      "trainAvgR": 0.177,
      "trainPf": 1.55,
      "oosCount": 124,
      "oosWinRate": 60.5,
      "oosAvgR": 0.14,
      "oosPf": 1.44
    },
    {
      "name": "لانگ پولبک هم‌روند گلدن‌کراس (EMA50>EMA200)",
      "rule": "EMA200 Slope > 0.5% & EMA50 > EMA200 & Pullback ≥ 1% & Near 24h Low",
      "category": "structure",
      "trainCount": 36,
      "trainWinRate": 80.6,
      "trainAvgR": 0.525,
      "trainPf": 4.74,
      "oosCount": 11,
      "oosWinRate": 54.5,
      "oosAvgR": -0.157,
      "oosPf": 0.6
    },
    {
      "name": "ساختار هارمونیک و تخلیه موج (L1/L2 و L1/L3)",
      "rule": "r12 < 1.0 or r13 < 1.0 & Harmonic Error < 0.45",
      "category": "harmonic",
      "trainCount": 139,
      "trainWinRate": 68.3,
      "trainAvgR": 0.246,
      "trainPf": 1.86,
      "oosCount": 90,
      "oosWinRate": 56.7,
      "oosAvgR": 0.069,
      "oosPf": 1.22
    },
    {
      "name": "بازگشت لگ غول‌پیکر (سبز/قرمز) با فیلتر رژیم",
      "rule": "L1 = Giant (Green/Red) & ML Score ≥ Threshold",
      "category": "legs",
      "trainCount": 6,
      "trainWinRate": 50,
      "trainAvgR": -0.224,
      "trainPf": 0.56,
      "oosCount": 2,
      "oosWinRate": 100,
      "oosAvgR": 0.413,
      "oosPf": 99
    },
    {
      "name": "بازگشت لگ آبی استراتژی ۲ (CD/EF) با استاپ ضداسویپ",
      "rule": "L1 = Blue/Dark-Blue (CD/EF) & Anti-Sweep SL",
      "category": "legs",
      "trainCount": 11,
      "trainWinRate": 45.5,
      "trainAvgR": -0.471,
      "trainPf": 0.17,
      "oosCount": 13,
      "oosWinRate": 46.1,
      "oosAvgR": -0.127,
      "oosPf": 0.68
    },
    {
      "name": "کلایمکس یا تخلیه حجم + شکست پیوت P3",
      "rule": "Vol(L1)/Vol(L3) < 0.85 or Climax > 1.8 & Sweep P3",
      "category": "volume",
      "trainCount": 223,
      "trainWinRate": 67.3,
      "trainAvgR": 0.234,
      "trainPf": 1.79,
      "oosCount": 117,
      "oosWinRate": 59,
      "oosAvgR": 0.117,
      "oosPf": 1.35
    }
  ],
  "isDefault": true
};

registerDefaultMlModelFactory(() => PRETRAINED_XT_5M_ML_MODEL);
