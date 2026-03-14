/**
 * WordPiece tokenizer for DistilBERT.
 * Loads vocab.txt from the bundled asset and exposes encode().
 */
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const CLS = 101;
const SEP = 102;
const UNK = 100;
const PAD = 0;
const MAX_LEN = 128;

let vocab: Map<string, number> | null = null;

export async function loadVocab(): Promise<void> {
  if (vocab) return;
  // vocab.txt is copied to assets/models/ by the convert script placeholder;
  // fall back to the pretrained directory via a bundled asset declaration.
  const asset = Asset.fromModule(require('../../assets/models/vocab.txt'));
  await asset.downloadAsync();
  const text = await FileSystem.readAsStringAsync(asset.localUri!);
  vocab = new Map(text.split('\n').map((token: string, id: number) => [token.trim(), id]));
}

function tokenizeWord(word: string): number[] {
  if (!vocab) return [UNK];
  if (vocab.has(word)) return [vocab.get(word)!];

  // WordPiece: greedily match longest subword
  const ids: number[] = [];
  let start = 0;
  while (start < word.length) {
    let end = word.length;
    let found = false;
    while (end > start) {
      const sub = start === 0 ? word.slice(start, end) : '##' + word.slice(start, end);
      if (vocab.has(sub)) {
        ids.push(vocab.get(sub)!);
        start = end;
        found = true;
        break;
      }
      end--;
    }
    if (!found) {
      ids.push(UNK);
      start++;
    }
  }
  return ids;
}

export function encode(text: string, maxLen = MAX_LEN): { inputIds: number[]; attentionMask: number[] } {
  const words = text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
  const tokens: number[] = [CLS];
  for (const word of words) {
    tokens.push(...tokenizeWord(word));
    if (tokens.length >= maxLen - 1) break;
  }
  tokens.push(SEP);

  const inputIds = tokens.slice(0, maxLen);
  const attentionMask = new Array(inputIds.length).fill(1);

  // Pad to maxLen
  while (inputIds.length < maxLen) {
    inputIds.push(PAD);
    attentionMask.push(0);
  }

  return { inputIds, attentionMask };
}
