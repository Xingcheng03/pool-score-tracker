import React from "react";
import AccountSettingsForm from "../components/AccountSettingsForm.jsx";

export default function AccountPage() {
  return (
    <div>
      <h1 className="h1">账号设置</h1>
      <p className="sub">所有用户都可以修改自己的用户名和密码。修改密码需要输入当前密码。</p>

      <div className="card settingsCard">
        <AccountSettingsForm />
      </div>
    </div>
  );
}
