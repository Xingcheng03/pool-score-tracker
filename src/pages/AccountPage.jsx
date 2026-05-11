import React from "react";
import AccountSettingsForm from "../components/AccountSettingsForm.jsx";
import { useT } from "../lib/i18n.jsx";

export default function AccountPage() {
  const t = useT();
  return (
    <div>
      <h1 className="h1">{t("账号设置", "Account Settings")}</h1>
      <p className="sub">{t(
        "所有用户都可以修改自己的用户名和密码。修改密码需要输入当前密码。",
        "Any user can change their own username and password. Changing the password requires entering the current password.",
      )}</p>

      <div className="card settingsCard">
        <AccountSettingsForm />
      </div>
    </div>
  );
}
