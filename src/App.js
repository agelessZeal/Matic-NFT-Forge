import { useState, useCallback } from "react";
import { Container, Row, Col, Image, Form } from "react-bootstrap";
import dayjs from "dayjs";
import ipfs from "./utils/ipfs";
import TimePicker from "react-bootstrap-time-picker";

// Web3
import Web3 from "web3";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Torus from "@toruslabs/torus-embed";
import Authereum from "authereum";
// import { erc20Abi, forgeAbi } from "./abis";
import { abi as erc20Abi } from "./abis/ERC20.json";
import { abi as forgeAbi } from "./abis/ForgeToken.json";
import { FORGE_ADDRESS, ZUT_ADDRESS, ZERO_ADDRESS } from "./constants";

// CSS
import "./App.css";

// Images
import image from "./assets/logo.png";
import forgeButton from "./assets/forgeButton.png";
import uploadButton from "./assets/uploadButton.png";

// Components
import Header from "./components/Header";
import Alert from "./components/Alert";

import { NETWORK_ID, RPC_PROVIDER } from "./constants";

var utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

// Web3 Modal
const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      // infuraId: "36bbdc3ed5bd449fad0374a2e07b850a", // required
      rpc: {
        [NETWORK_ID]: RPC_PROVIDER,
      },
    },
  },
  torus: {
    package: Torus, // required
    options: {
      networkParams: {
        host: RPC_PROVIDER, // optional
        networkId: NETWORK_ID, // optional
      },
      config: {
        buildEnv: "production", // optional
      },
    },
  },
  authereum: {
    package: Authereum,
  },
};
const web3Modal = new Web3Modal({
  network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions, // required
  theme: "dark",
});

function App() {
  const [account, setAccount] = useState(null);
  // Details
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [amountTokens, setAmountTokens] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Min Balance Condition
  const [option1Checked, setOption1Checked] = useState(false);
  const [tokenAddress, setTokenAddress] = useState(ZUT_ADDRESS);
  const [minBalance, setMinBalance] = useState(0);

  // Expiration Condition
  const [option2Checked, setOption2Checked] = useState(false);
  const [expirationDate, setExpirationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [expirationTime, setExpirationTime] = useState(0);

  // Expiration Condition
  const [isPaymentETH, setIsPaymentETH] = useState(true);

  // Web3
  const [forgeContract, setForgeContract] = useState(null);
  const [zutContract, setZutContract] = useState(null);

  // Alerts
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [link, setLink] = useState(null);

  // Functions
  const logout = () => {
    setAccount(null);
    web3Modal.clearCachedProvider();
  };

  const toWei = (num) => window.web3.utils.toWei(String(num));
  const fromWei = (num) => Number(window.web3.utils.fromWei(String(num)));

  const reset = () => {
    setFile(null);
    setFileName(null);
    setName(null);
    setDescription(null);
    setOption1Checked(false);
    setTokenAddress(ZUT_ADDRESS);
    setMinBalance(null);
    setOption2Checked(false);
    setExpirationTime(null);
    setIsPaymentETH(true);
  };

  const connectWeb3 = useCallback(async () => {
    try {
      const provider = await web3Modal.connect();

      provider.on("accountsChanged", (acc) => {
        setAccount(acc[0]);
      });

      window.web3 = new Web3(provider);

      const acc = await window.web3.eth.getAccounts();
      setAccount(acc[0]);

      window.zut = new window.web3.eth.Contract(erc20Abi, ZUT_ADDRESS);
      window.forge = new window.web3.eth.Contract(forgeAbi, FORGE_ADDRESS);

      setZutContract(window.zut);
      setForgeContract(window.forge);

      // Suscribe to Burn Events
      window.forge.events
        .TransferSingle()
        .on("data", async ({ returnValues }) => {
          if (returnValues.to === ZERO_ADDRESS) {
            console.log("Token Burned!", returnValues.from, returnValues.id);
          }
        });

      console.log("Connected Account: ", acc[0]);
    } catch (error) {
      console.log(error.message);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = (_file) => {
    setFileName(_file.name);
    var reader = new FileReader();
    reader.readAsArrayBuffer(_file);
    reader.onloadend = () => {
      // console.log(Buffer(reader.result));
      setFile(Buffer(reader.result));
    };
  };

  const addToIpfs = async (content) => {
    console.log("adding to IPFS...");
    const added = await ipfs.add(content, {
      progress: (prog) => console.log(`received: ${prog}`),
    });
    return added.cid.toString();
  };

  const createToken = async () => {
    console.log("Paying with ETH?", isPaymentETH);
    console.log(`Creating ${amountTokens} NFTs...`);

    // if (!option1Checked && !option2Checked)
    //   return console.log("Must select at least one condition");

    try {
      const ipfsHash = await addToIpfs(file);
      console.log("File Ipfs Hash", ipfsHash);

      const tokenCondition = option1Checked ? tokenAddress : ZERO_ADDRESS;
      const minBalanceCondition = option1Checked ? minBalance : 0;
      const expirationCondition = option2Checked
        ? dayjs(expirationDate).unix() + expirationTime
        : 0;

      const attributes = [];
      if (expirationCondition > 0) {
        attributes.push({
          display_type: "date",
          trait_type: "Expiration",
          value: expirationCondition,
        });
      }

      if (minBalanceCondition > 0) {
        attributes.push({
          trait_type: "Min Balance",
          value: minBalanceCondition,
        });
        attributes.push({
          trait_type: "Min Token",
          value: tokenCondition,
        });
      }

      const schema = {
        name,
        description,
        image: "ipfs://" + ipfsHash,
        attributes,
      };

      console.log("Token Schema", schema);

      const tokenInfo = JSON.stringify(schema);
      const schemaHash = await addToIpfs(tokenInfo);

      console.log("Schema Ipfs Hash", schemaHash);

      let tx;
      if (isPaymentETH) {
        const ethFee = await forgeContract.methods.ethFee().call();
        console.log("ETH FEE", fromWei(ethFee));

        tx = await forgeContract.methods
          .buyWithETH(
            amountTokens,
            tokenCondition,
            toWei(minBalanceCondition),
            expirationCondition,
            schemaHash
          )
          .send({ from: account, value:  ethFee });
      } else {
        const zutFee = await forgeContract.methods.zutFee().call();
        console.log("ZUT FEE", fromWei(zutFee));

        const allowance = await zutContract.methods
          .allowance(account, FORGE_ADDRESS)
          .call();
        console.log("Allowance", fromWei(allowance));
        if (allowance < fromWei( zutFee)) {
          const infinite = window.web3.utils
            .toBN(2)
            .pow(window.web3.utils.toBN(256).sub(window.web3.utils.toBN(1)));
          await zutContract.methods
            .approve(FORGE_ADDRESS, infinite)
            .send({ from: account });
        }

        tx = await forgeContract.methods
          .buyWithZUT(
            amountTokens,
            tokenCondition,
            toWei(minBalanceCondition),
            expirationCondition,
            schemaHash
          )
          .send({ from: account });
      }

      const { id } = tx.events.TransferSingle.returnValues;
      setConfirmation(
        `Successfully created ${amountTokens} tokens with id #${id}`
      );
      setLink(
        `https://opensea.io/assets/matic/${FORGE_ADDRESS}/${id}`
      );
      console.log("Tx Receipt", tx);

      reset();
    } catch (error) {
      setError(error.message);
      console.log(error.message);
    }
  };

  return (
    <div>
      <Header account={account} logout={logout} connectWeb3={connectWeb3} />
      <Container className="mt-5">
        <Row className="justify-content-center">
          <Col>
            <Image src={image} className="logo" alt="NFT Forge Logo"></Image>
          </Col>
          <Col>
            {/* File Upload */}
            <div>
              {!file && (
                <>
                  <div id="upload-container">
                    <div id="fileUpload">
                      <input
                        id="file"
                        type="file"
                        name="file"
                        className="inputfile"
                        onChange={(e) => loadFile(e.target.files[0])}
                      />
                      <label htmlFor="file" id="fileLabel">
                        <img src={uploadButton} className="upload-button" />
                      </label>
                    </div>
                  </div>
                  <p className="mt-4">
                    Please upload a PNG, GIF, WEBP, or MP4 Max 30mb
                  </p>
                </>
              )}
              {fileName && (
                <label htmlFor="file" className="mb">
                  <strong>File Uploaded: </strong>
                  {fileName}
                </label>
              )}

              <Form className="mt-5">
                <Form.Group as={Row}>
                  <Form.Label column sm="3">
                    NFT Name
                  </Form.Label>
                  <Col sm="9" className="align-self-center">
                    <Form.Control
                      type="text"
                      placeholder="Project Name"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row}>
                  <Form.Label column sm="3">
                    Description
                  </Form.Label>
                  <Col sm="9" className="align-self-center">
                    <Form.Control
                      type="text"
                      placeholder="Project Description"
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row}>
                  <Form.Label column sm="3">
                    Amount Tokens
                  </Form.Label>
                  <Col sm="9" className="align-self-center">
                    <Form.Control
                      type="number"
                      placeholder="100"
                      onChange={(e) => setAmountTokens(e.target.value)}
                    />
                  </Col>
                </Form.Group>
              </Form>
              <p className="mt-5">
                Please add specialized properties to the NFT (select one or
                multiple):{" "}
              </p>
            </div>

            {/* Option 1: Min Balance in Owner Wallet */}
            <div className="ml-3">
              <Form.Check type={"checkbox"}>
                <Form.Check.Input
                  type={"checkbox"}
                  onChange={(e) => setOption1Checked(e.target.checked)}
                />
                <Form.Check.Label>{`Holder must hold specific quantity of tokens`}</Form.Check.Label>
              </Form.Check>

              {option1Checked && (
                <Form className="mt-2 ml-2">
                  {/* <Form.Group as={Row} controlId="formPlaintextPassword">
                    <Form.Label column sm="3">
                      Token Address
                    </Form.Label>
                    <Col sm="9" className="align-self-center">
                      <Form.Control
                        type="text"
                        placeholder={`Eg. ${ZUT_ADDRESS}`}
                        value={tokenAddress}
                        readOnly={true}
                        // onChange={(e) => setTokenAddress(e.target.value)}
                      />
                    </Col>
                  </Form.Group> */}

                  <Form.Group as={Row} controlId="formPlaintextPassword">
                    <Form.Label column sm="3">
                      Minimum Balance Of ZUT
                    </Form.Label>
                    <Col sm="9" className="align-self-center">
                      <Form.Control
                        type="text"
                        placeholder="Eg. 1000"
                        onChange={(e) => setMinBalance(e.target.value)}
                      />
                    </Col>
                  </Form.Group>
                </Form>
              )}
            </div>

            {/* Option 2: Expiration Time */}
            <div className="mt-4 ml-3">
              <Form.Check type={"checkbox"}>
                <Form.Check.Input
                  type={"checkbox"}
                  onChange={(e) => setOption2Checked(e.target.checked)}
                />
                <Form.Check.Label>{`NFT Auto Destructs at (Local Time Zone)`}</Form.Check.Label>
              </Form.Check>
              {option2Checked && (
                <Form className="mt-2 ml-2">
                  <Form.Control
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="mb-3 w-50"
                  />
                  <TimePicker
                    className="w-50"
                    step={60}
                    value={expirationTime}
                    onChange={(time) => setExpirationTime(time)}
                  />
                </Form>
              )}
            </div>

            {/* Select Payment */}
            {/* <div className="mt-4 ml-3">
              <Form.Group as={Row} controlId="formPlaintextPassword">
                <Form.Label as="legend" column sm="4">
                  Payment Type
                </Form.Label>
                <Col sm="8" className="align-self-center">
                  <Form.Check
                    type="radio"
                    label="MATIC"
                    checked={isPaymentETH}
                    onChange={(e) => setIsPaymentETH(true)}
                  />
                  <Form.Check
                    type="radio"
                    label="ZUT"
                    checked={!isPaymentETH}
                    onChange={(e) => setIsPaymentETH(false)}
                  />
                </Col>
              </Form.Group>
            </div> */}

            {/* Token Creation */}
            {account && file && (
              <div className="mt-4">
                <Image
                  src={forgeButton}
                  alt="NFT Forge Button"
                  className="forge-button"
                  onClick={createToken}
                />
              </div>
            )}
          </Col>
        </Row>
      </Container>
      {error && <Alert type="danger" content={error} />}
      {confirmation && (
        <Alert type="success" content={confirmation} link={link} />
      )}
    </div>
  );
}

export default App;
