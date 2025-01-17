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
        
        // Use parallel iterator for processing
        let mut unique_voters: HashSet<String> = HashSet::new();
        let (approved, rejected) = votes.par_iter()
            .fold(
                || (0.0, 0.0),
                |(mut app, mut rej), vote| {
                    let balance = vote.balance.parse::<f64>().unwrap_or(0.0);
                    if vote.approved > 0 {
                        app += balance;
                    } else {
                        rej += balance;
                    }
                    (app, rej)
                }
            )
            .reduce(
                || (0.0, 0.0),
                |a, b| (a.0 + b.0, a.1 + b.1)
            );

        // Collect unique voters
        votes.iter().for_each(|vote| {
            unique_voters.insert(vote.voter.clone());
        });

        // Prepare result
        let result = ChunkResult {
            approved,
            rejected,
            voters: unique_voters.into_iter().collect(),
        };

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
} 