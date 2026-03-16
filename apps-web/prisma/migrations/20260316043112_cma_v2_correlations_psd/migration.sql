-- RenameIndex (conditional; index may not exist on fresh replay)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.relkind = 'i'
      AND c.relname = 'PMFundDistributionAllocation_distributionEventId_clientCommi_ke'
  ) THEN
    EXECUTE 'ALTER INDEX "PMFundDistributionAllocation_distributionEventId_clientCommi_ke"
    RENAME TO "PMFundDistributionAllocation_distributionEventId_clientComm_key"';
  END IF;
END $$;
