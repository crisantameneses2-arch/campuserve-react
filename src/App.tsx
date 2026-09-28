import './App.css';

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

type Account = {
  id: string;
  username: string;
  password: string;
};

function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const getAccounts = async () => {
      const snapshot = await getDocs(collection(db, "accounts"));

      const accountList: Account[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Account, "id">),
      }));

      setAccounts(accountList);
    };

    getAccounts();
  }, []);

  return (
    <div>
      <h1>Accounts</h1>

      {accounts.map((account) => (
        <div key={account.id}>
          <p>ID: {account.id}</p>
          <p>Username: {account.username}</p>
          <p>Password: {account.password}</p>
        </div>
      ))}
    </div>
  );
}

export default App;