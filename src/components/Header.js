import React from "react";
import { Button } from "react-bootstrap";
import { BLOCK_EXPLORER } from "../constants";

export default function Header({ account, logout, connectWeb3 }) {
  return (
    <div className="float-right">
      {account ? (
        <>
          <h5 className="mr-3">
            Connected:{" "}
            <a
              href={`${BLOCK_EXPLORER}/address/${account}`}
              target="_blank"
              className="account-link"
            >
              {account.substring(0, 4) + "..." + account.substring(38, 42)}
            </a>
          </h5>
          <div className="float-right">
            <Button
              className="mr-5"
              variant="outline-secondary"
              size="sm"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={connectWeb3}
          className="connect-button mt-4 mr-5"
        >
          Connect to Web3
        </Button>
      )}
    </div>
  );
}
