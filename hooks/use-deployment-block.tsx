import { providers } from "ethers";
import { useState, useEffect, useRef } from "react";
import { UseDeploymentBlockResult } from "@/types/deployment";
import { ContractAddress } from "@/types/search";

const MAX_BLOCK_DIFF = 128;

export const useDeploymentBlock = (
  provider: providers.Provider,
  contractAddress: ContractAddress | undefined,
  deploymentBlock: number
): UseDeploymentBlockResult => {
  const [blockNumber, setBlockNumber] = useState<number | undefined>();
  const [success, setSuccess] = useState(false);
  const [currentSearchBlock, setCurrentSearchBlock] = useState<
    number | undefined
  >();
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const cancelSearchRef = useRef(false);

  const cancelSearch = () => {
    cancelSearchRef.current = true;
  };

  useEffect(() => {
    const findDeploymentBlock = async () => {
      if (!contractAddress || !provider) return;

      cancelSearchRef.current = false;

      const currentCode = await provider.getCode(contractAddress);
      const currentBlockNumber =
        deploymentBlock || (await provider.getBlockNumber());

      if (currentCode === "0x") {
        throw new Error("Contract not currently deployed");
      }

      let [lowerBound, upperBound] = [0, currentBlockNumber];
      let deployedBlockNumber: number | null = null;
      const maxIterations = Math.ceil(Math.log2(currentBlockNumber));

      if (currentBlockNumber - deploymentBlock > MAX_BLOCK_DIFF) {
        const lastBlock = currentBlockNumber - MAX_BLOCK_DIFF;
        lowerBound = lastBlock;
      }

      try {
        for (let i = 0; i < maxIterations && !cancelSearchRef.current; i++) {
          const mid = Math.floor((lowerBound + upperBound) / 2);
          setCurrentSearchBlock(mid);
          setDeploymentProgress((i / maxIterations) * 100);

          const code = await provider.getCode(contractAddress, mid);
          const isDeployed = code !== "0x";

          if (isDeployed) {
            deployedBlockNumber = mid;
            const prevCode = await provider.getCode(contractAddress, mid - 1);

            if (mid === 0 || prevCode === "0x") break;
            upperBound = mid - 1;
          } else {
            lowerBound = mid + 1;
          }
        }
      } catch (err: any) {
        console.warn(err);
        setSuccess(false);
      }

      if (cancelSearchRef.current) {
        setSuccess(false);
      } else if (deployedBlockNumber !== null) {
        setBlockNumber(deployedBlockNumber);
        setSuccess(true);
        setDeploymentProgress(100);
      }
    };

    findDeploymentBlock();

    return cancelSearch;
  }, [contractAddress, provider, deploymentBlock]);

  return {
    blockNumber,
    success,
    currentSearchBlock,
    deploymentProgress,
  };
};
