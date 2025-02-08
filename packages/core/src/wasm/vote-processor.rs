use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;
use std::collections::HashSet;

#[derive(Serialize, Deserialize)]
pub struct VoteData {
    balance: String,
    approved: i32,
    voter: String,
}

#[derive(Serialize, Deserialize)]
pub struct ChunkResult {
    approved: f64,
    rejected: f64,
    voters: Vec<String>,
}

#[wasm_bindgen]
pub struct WasmVoteProcessor {
    chunk_size: usize,
}

#[wasm_bindgen]
impl WasmVoteProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmVoteProcessor {
            chunk_size: 100000,
        }
    }

    #[wasm_bindgen]
    pub fn process_vote_chunk(&self, votes_js: JsValue) -> Result<JsValue, JsValue> {
        // Parse input votes
        let votes: Vec<VoteData> = serde_wasm_bindgen::from_value(votes_js)?;
        
        // Use parallel iterator for processing, propagating parse errors
        let (approved, rejected) = votes.par_iter()
            .try_fold(
                || Ok((0.0, 0.0)),
                |(app, rej), vote| -> Result<(f64, f64), String> {
                    let balance = vote.balance.parse::<f64>()
                        .map_err(|e| format!("Balance parse error for voter {}: {:?}", vote.voter, e))?;
                    if vote.approved > 0 {
                        Ok((app + balance, rej))
                    } else {
                        Ok((app, rej + balance))
                    }
                }
            )
            .try_reduce(
                || Ok((0.0, 0.0)),
                |left, right| {
                    let (a1, r1) = left?;
                    let (a2, r2) = right?;
                    Ok((a1 + a2, r1 + r2))
                }
            )
            .map_err(|e| JsValue::from_str(&e))?;

        // Collect unique voters (order is arbitrary)
        let unique_voters: HashSet<String> = votes.iter().map(|vote| vote.voter.clone()).collect();

        let result = ChunkResult {
            approved,
            rejected,
            voters: unique_voters.into_iter().collect(),
        };

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
} 